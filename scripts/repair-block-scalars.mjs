#!/usr/bin/env node
/** One-off repair for entries whose upstream YAML frontmatter used block
 * scalars (`description: >` / `>-`) — the original importer read the bare
 * marker instead of the folded text, so meta.yaml (and SOUL.md persona /
 * SKILL.md description) ended up with ">" / ">-".
 *
 * Re-reads the true description from the pinned upstream clones (or GitHub
 * raw at source.commit), folds block scalars, and rewrites:
 *   - meta.yaml description (+ zh via --zh TSV after manual translation)
 *   - SOUL.md persona (experts) / SKILL.md description (skills)
 *
 * Usage:
 *   node scripts/repair-block-scalars.mjs           # fix EN, write /tmp/repair-zh.tsv
 *   node scripts/repair-block-scalars.mjs --zh /tmp/repair-zh.tsv  # apply translations
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMeta } from "./lib.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENTRIES = path.join(ROOT, "entries");
const CLONES = {
  "wshobson/agents": "/tmp/import-src/wshobson-agents",
  "VoltAgent/awesome-claude-code-subagents": "/tmp/import-src/voltagent-subagents",
};

const zhFileIdx = process.argv.indexOf("--zh");

/** YAML frontmatter parser with block-scalar folding (| and >, with - chomp). */
function foldFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const lines = m[1].split(/\r?\n/);
  const out = {};
  for (let i = 0; i < lines.length; i++) {
    const km = lines[i].match(/^([A-Za-z_-]+):\s*(.*)$/);
    if (!km) continue;
    const key = km[1];
    let val = km[2].trim();
    if (/^[>|][0-9]*[+-]?$/.test(val)) {
      const parts = [];
      while (i + 1 < lines.length && /^[ \t]/.test(lines[i + 1])) {
        parts.push(lines[++i].trim());
      }
      val = parts.join(" ").replace(/\s+/g, " ").trim();
    } else {
      val = val.replace(/^["']|["']$/g, "");
    }
    out[key] = val;
  }
  return out;
}

function quote(s) {
  return JSON.stringify(s);
}

/** Replace `key: ...` value on the matching line of a generated flat file. */
function setField(file, key, value) {
  const text = fs.readFileSync(file, "utf8");
  const re = new RegExp(`^(${key}):.*$`, "m");
  if (!re.test(text)) throw new Error(`${key}: not found in ${file}`);
  fs.writeFileSync(file, text.replace(re, `$1: ${quote(value)}`));
}

function upstreamText(meta) {
  const clone = CLONES[meta.source?.repo?.replace("https://github.com/", "")];
  if (!clone) throw new Error(`no local clone for ${meta.source.repo}`);
  for (const p of meta.source.paths ?? []) {
    const f = path.join(clone, p);
    if (fs.existsSync(f)) {
      // skill entries may point at the skill directory — descriptions live in SKILL.md
      const file = fs.statSync(f).isDirectory() ? path.join(f, "SKILL.md") : f;
      if (fs.existsSync(file)) return fs.readFileSync(file, "utf8");
    }
    // fallback: match by basename anywhere in the clone
    try {
      const hit = execFileSync("find", [clone, "-name", path.basename(p), "-type", "f"], { encoding: "utf8" }).split("\n")[0];
      if (hit) return fs.readFileSync(hit, "utf8");
    } catch {}
  }
  throw new Error(`upstream file not found in ${clone}`);
}

// ── pass 1: fix EN descriptions from upstream ───────────────────────────────
const fixed = [];
for (const id of fs.readdirSync(ENTRIES).sort()) {
  const dir = path.join(ENTRIES, id);
  const metaFile = path.join(dir, "meta.yaml");
  if (!fs.existsSync(metaFile)) continue;
  const meta = parseMeta(fs.readFileSync(metaFile, "utf8"));
  const desc = String(meta.description ?? "");
  if (!/^[>|][0-9]*[+-]?$/.test(desc.trim())) continue;

  const up = foldFrontmatter(upstreamText(meta));
  const trueDesc = (up.description ?? "").trim();
  if (trueDesc.length < 10) throw new Error(`${id}: upstream description still too short`);
  setField(metaFile, "description", trueDesc);

  if (meta.type === "expert") {
    const soul = path.join(dir, "SOUL.md");
    setField(soul, "persona", trueDesc);
  } else {
    const skill = path.join(dir, "SKILL.md");
    const fm = fs.readFileSync(skill, "utf8");
    if (/^description: (>|>-)\s*$/m.test(fm)) setField(skill, "description", trueDesc);
  }
  fixed.push({ id, en: trueDesc });
  console.log(`fixed ${id}: ${trueDesc.slice(0, 80)}…`);
}

if (fixed.length === 0) console.log("no block-scalar descriptions found");

// ── emit zh TSV for manual translation (id<TAB>zh description) ──────────────
if (fixed.length && zhFileIdx < 0) {
  const out = fixed.map((f) => `${f.id}\t${f.en}`).join("\n") + "\n";
  const tsv = "/tmp/repair-zh.tsv";
  fs.writeFileSync(tsv, out);
  console.log(`\n${fixed.length} entries need zh translations → ${tsv} (fill col2, then re-run with --zh ${tsv})`);
}

// ── pass 2 (--zh file): apply translations to the i18n.zh block ─────────────
if (zhFileIdx >= 0) {
  const tsv = process.argv[zhFileIdx + 1];
  let n = 0;
  for (const line of fs.readFileSync(tsv, "utf8").split("\n").filter((l) => l.trim())) {
    const [id, ...rest] = line.split("\t");
    const zh = rest.join("\t").trim();
    if (!zh) continue;
    const file = path.join(ENTRIES, id, "meta.yaml");
    const text = fs.readFileSync(file, "utf8");
    // only the indented description under i18n.zh — never the top-level one
    const re = /(  zh:\n    name: [^\n]*\n    description: )[^\n]*/;
    if (!re.test(text)) throw new Error(`${id}: i18n.zh.description line not found`);
    fs.writeFileSync(file, text.replace(re, `$1${quote(zh)}`));
    n++;
  }
  console.log(`applied ${n} zh translations`);
}
