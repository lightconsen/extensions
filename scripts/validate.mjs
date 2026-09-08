#!/usr/bin/env node
/** Validate every entry in entries/ — run in CI on PRs and before publish.
 *
 * Fails on: missing files, bad meta.yaml, unknown license/category, oversize
 * files, symlinks, binary-looking files. Warns on: unknown upstream commit,
 * prompt-injection heuristics.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMeta, CATEGORIES, LICENSES, ID_RE, idValid, VERSION_RE, COMMIT_RE, REPO_RE } from "./lib.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENTRIES = path.join(ROOT, "entries");

const MAX_FILE = 512 * 1024;
const MAX_ENTRY = 8 * 1024 * 1024;
/** hard-fail: executable/binary payloads. Others (pdf/zip/images/media) warn —
 * upstream skills legitimately ship reference assets; human review gates them. */
const BIN_FAIL = new Set([
  ".exe", ".dll", ".so", ".dylib", ".bin", ".o", ".a", ".pyc", ".class", ".wasm", ".node",
  ".7z", ".rar",
]);
const BIN_WARN = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".pdf", ".zip", ".gz", ".tar", ".tgz",
  ".mp3", ".mp4", ".mov", ".avi", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx",
]);
const INJECTION_RE = [
  /ignore (all )?previous instructions/i,
  /disregard (all )?(previous|prior) (instructions|prompts)/i,
  /reveal (your |the )?(system )?prompt/i,
  /you must (obey|follow) only (my |these )?instructions/i,
];

const errors = [];
const warnings = [];
const err = (id, msg) => errors.push(`${id}: ${msg}`);
const warn = (id, msg) => warnings.push(`${id}: ${msg}`);

const CONNECTORS = path.join(ROOT, "connectors");
const AUTHS = ["none", "oauth", "operator"];

function walk(dir, base = dir, out = []) {
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.lstatSync(p);
    if (st.isSymbolicLink()) {
      err(path.relative(ENTRIES, base), `symlink not allowed: ${path.relative(ENTRIES, p)}`);
      continue;
    }
    if (st.isDirectory()) walk(p, base, out);
    else out.push({ p, st });
  }
  return out;
}

function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : null;
}

let ok = 0;
for (const id of fs.readdirSync(ENTRIES).sort()) {
  const dir = path.join(ENTRIES, id);
  if (!fs.statSync(dir).isDirectory()) {
    err(id, "stray file in entries/ (only entry directories allowed)");
    continue;
  }

  // ── meta.yaml ──
  let meta;
  try {
    meta = parseMeta(fs.readFileSync(path.join(dir, "meta.yaml"), "utf8"));
  } catch (e) {
    err(id, `meta.yaml: ${e.message}`);
    continue;
  }
  if (meta.id !== id) err(id, `meta.id "${meta.id}" != directory name`);
  if (!idValid(String(meta.id ?? ""))) err(id, `id must match ${ID_RE} (no "..")`);
  if (!["expert", "skill"].includes(meta.type)) err(id, `type must be expert|skill (got ${meta.type})`);
  if (!VERSION_RE.test(String(meta.version ?? ""))) err(id, `version must be semver (got ${meta.version})`);
  if (!CATEGORIES.includes(meta.category)) err(id, `category "${meta.category}" not allowed (use one of: ${CATEGORIES.join(", ")})`);
  if (typeof meta.name !== "string" || !meta.name.trim()) err(id, "name missing");
  if (typeof meta.description !== "string" || meta.description.trim().length < 10) err(id, "description missing/too short");
  if ((meta.description ?? "").length > 2000) err(id, "description > 2000 chars");
  if (!LICENSES.includes(meta.license)) err(id, `license "${meta.license}" not allowed (allowlist: ${LICENSES.join(", ")})`);
  if (!REPO_RE.test(String(meta.source?.repo ?? ""))) err(id, `source.repo must be a github.com URL (got ${meta.source?.repo})`);
  const commit = String(meta.source?.commit ?? "");
  if (!COMMIT_RE.test(commit)) warn(id, `upstream commit "${commit}" is not pinned (7-40 hex)`);
  if (!Array.isArray(meta.source?.paths) || meta.source.paths.length === 0) err(id, "source.paths must list at least one upstream path");
  const zh = meta.i18n?.zh ?? {};
  if (typeof zh.name !== "string" || !zh.name.trim()) err(id, "i18n.zh.name missing (zh translation is required)");
  if (typeof zh.description !== "string" || !zh.description.trim()) err(id, "i18n.zh.description missing");

  // ── layout ──
  for (const f of ["meta.yaml", "LICENSE", "ATTRIBUTION.md"]) {
    if (!fs.existsSync(path.join(dir, f))) err(id, `missing ${f}`);
  }
  const main = meta.type === "expert" ? "SOUL.md" : "SKILL.md";
  const other = meta.type === "expert" ? "SKILL.md" : "SOUL.md";
  if (!fs.existsSync(path.join(dir, main))) err(id, `missing ${main} for type=${meta.type}`);
  if (fs.existsSync(path.join(dir, other))) err(id, `unexpected ${other} for type=${meta.type}`);

  const fm = main && fs.existsSync(path.join(dir, main)) ? frontmatter(fs.readFileSync(path.join(dir, main), "utf8")) : null;
  if (fm === null) {
    err(id, `${main} has no frontmatter block`);
  } else if (meta.type === "expert") {
    if (!/^name:/m.test(fm)) err(id, "SOUL.md frontmatter missing name:");
    if (!/^persona:/m.test(fm)) err(id, "SOUL.md frontmatter missing persona:");
  } else {
    if (!/^name:/m.test(fm)) err(id, "SKILL.md frontmatter missing name:");
    if (!/^description:/m.test(fm)) err(id, "SKILL.md frontmatter missing description:");
  }

  // ── hygiene ──
  let total = 0;
  for (const { p, st } of walk(dir)) {
    total += st.size;
    if (st.size > MAX_FILE) err(id, `file > 512KB: ${path.relative(ENTRIES, p)}`);
    const ext = path.extname(p).toLowerCase();
    if (BIN_FAIL.has(ext)) err(id, `binary file not allowed: ${path.relative(ENTRIES, p)}`);
    if (BIN_WARN.has(ext)) warn(id, `binary-ish asset (review): ${path.relative(ENTRIES, p)}`);
    if (path.basename(p).startsWith(".") && path.basename(p) !== ".gitignore") {
      warn(id, `dotfile: ${path.relative(ENTRIES, p)}`);
    }
    if (/\.(md|txt|json|yaml|yml|js|ts|py|rb|go|rs|java|sh|html|css|csv|xml)$/.test(ext)) {
      const text = fs.readFileSync(p, "utf8");
      for (const re of INJECTION_RE) {
        if (re.test(text)) {
          warn(id, `possible prompt-injection pattern /${re.source}/i in ${path.relative(ENTRIES, p)}`);
          break;
        }
      }
    }
  }
  if (total > MAX_ENTRY) err(id, `entry > 2MB (${total} bytes)`);

  ok++;
}

// ── connectors/ — relay registry metadata (no archive, single meta.yaml) ────
let okC = 0;
const connectorIds = new Set();
if (fs.existsSync(CONNECTORS)) {
  const entryIds = new Set(
    fs.readdirSync(ENTRIES).filter((n) => fs.statSync(path.join(ENTRIES, n)).isDirectory()),
  );
  for (const id of fs.readdirSync(CONNECTORS).sort()) {
    const dir = path.join(CONNECTORS, id);
    if (!fs.statSync(dir).isDirectory()) {
      err(id, "stray file in connectors/ (only connector directories allowed)");
      continue;
    }
    if (entryIds.has(id)) err(id, "id collides with an entries/ directory (shared catalog namespace)");
    connectorIds.add(id);

    let meta;
    try {
      meta = parseMeta(fs.readFileSync(path.join(dir, "meta.yaml"), "utf8"));
    } catch (e) {
      err(id, `meta.yaml: ${e.message}`);
      continue;
    }
    if (meta.id !== id) err(id, `meta.id "${meta.id}" != directory name`);
    if (!idValid(String(meta.id ?? ""))) err(id, `id must match ${ID_RE} (no "..")`);
    if (meta.type !== "connector") err(id, `type must be connector (got ${meta.type})`);
    if (!VERSION_RE.test(String(meta.version ?? ""))) err(id, `version must be semver (got ${meta.version})`);
    if (!CATEGORIES.includes(meta.category)) err(id, `category "${meta.category}" not allowed`);
    if (typeof meta.name !== "string" || !meta.name.trim()) err(id, "name missing");
    if (typeof meta.description !== "string" || meta.description.trim().length < 10) err(id, "description missing/too short");
    if ((meta.description ?? "").length > 2000) err(id, "description > 2000 chars");
    const url = String(meta.connector?.url ?? "");
    if (!/^https:\/\/[^\s"'<>()]+$/.test(url)) err(id, `connector.url must be an https:// MCP endpoint (got ${url})`);
    if (!AUTHS.includes(meta.connector?.auth)) err(id, `connector.auth must be one of ${AUTHS.join("|")} (got ${meta.connector?.auth})`);
    if (meta.license != null && !LICENSES.includes(meta.license)) err(id, `license "${meta.license}" not in allowlist`);
    if (meta.source?.repo != null && !REPO_RE.test(String(meta.source.repo))) err(id, `source.repo must be a github.com URL (got ${meta.source.repo})`);
    const zh = meta.i18n?.zh ?? {};
    if (typeof zh.name !== "string" || !zh.name.trim()) err(id, "i18n.zh.name missing (zh translation is required)");
    if (typeof zh.description !== "string" || !zh.description.trim()) err(id, "i18n.zh.description missing");

    const extra = fs.readdirSync(dir).filter((f) => f !== "meta.yaml");
    if (extra.length) err(id, `unexpected files (only meta.yaml allowed): ${extra.join(", ")}`);
    if (meta.license == null && meta.source?.repo == null) {
      warn(id, "no license/source.repo provenance (recommended)");
    }
    okC++;
  }
}

for (const w of warnings) console.log(`⚠ ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\nvalidate FAILED: ${ok} ok, ${errors.length} error(s), ${warnings.length} warning(s)`);
  process.exit(1);
}
console.log(`validate ok: ${ok} entries, ${okC} connectors, ${warnings.length} warning(s)`);
