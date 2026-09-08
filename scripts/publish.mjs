#!/usr/bin/env node
/** Publish packed entries to the live catalog: R2 archives + D1 upserts + verify.
 *
 * Requires `pack.mjs` output (.build/manifest.jsonl). Upsert touches CONTENT
 * columns only — visibility/credits_per_use/required_plan stay runtime-managed
 * via the cloud `ops catalog set`.
 *
 * Usage: node scripts/publish.mjs [--dry-run] [--changed] [--only RE] [--jobs N]
 *   --changed  publish only ids touched by `git diff HEAD~1 HEAD -- entries/`
 *
 * Env: CLOUDFLARE_API_TOKEN, CLOUDFLARE_ACCOUNT_ID, R2_BUCKET (default
 * syscity-cloud-archives), D1_DATABASE (default syscity-cloud).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const BUILD = path.join(ROOT, ".build");
const R2_BUCKET = process.env.R2_BUCKET ?? "syscity-cloud-archives";
const D1_DATABASE = process.env.D1_DATABASE ?? "syscity-cloud";
const SQL_CHUNK = 200;

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const changedOnly = argv.includes("--changed");
const jobs = argv.includes("--jobs") ? parseInt(argv[argv.indexOf("--jobs") + 1], 10) : 8;
const onlyIdx = argv.indexOf("--only");
const only = onlyIdx >= 0 ? new RegExp(argv[onlyIdx + 1]) : null;

const manifestFile = path.join(BUILD, "manifest.jsonl");
if (!fs.existsSync(manifestFile)) {
  console.error("manifest not found — run scripts/pack.mjs first");
  process.exit(1);
}
let manifest = fs.readFileSync(manifestFile, "utf8").split("\n").filter(Boolean).map(JSON.parse);

if (changedOnly) {
  const diff = execFileSync("git", ["diff", "--name-only", "HEAD~1", "HEAD", "--", "entries/"], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 8 * 1024 * 1024,
  });
  const touched = new Set(diff.split("\n").filter(Boolean).map((l) => l.split("/")[1]).filter(Boolean));
  manifest = manifest.filter((m) => touched.has(m.id));
  console.log(`git diff touched ${touched.size} entry dir(s)`);
}
if (only) manifest = manifest.filter((m) => only.test(m.id));
if (manifest.length === 0) {
  console.log("nothing to publish");
  process.exit(0);
}

const wrangler = (args, opts = {}) =>
  execFileSync("pnpm", ["exec", "wrangler", ...args], {
    cwd: ROOT,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
    ...opts,
  });

/** wrangler d1 execute --json prints preamble lines before the result array. */
function d1(args) {
  const out = wrangler(["d1", "execute", D1_DATABASE, "--remote", "--json", ...args]);
  const raw = JSON.parse(out.slice(out.indexOf("[")));
  return (Array.isArray(raw) ? raw[0]?.results : raw?.results) ?? [];
}

// ── R2 uploads (parallel) ───────────────────────────────────────────────────
if (!dryRun) {
  let i = 0;
  const fails = [];
  await Promise.all(
    Array.from({ length: jobs }, async () => {
      while (i < manifest.length) {
        const m = manifest[i++];
        const key = `${R2_BUCKET}/${m.id}/${m.version}/${m.id}.tar.gz`;
        try {
          wrangler(["r2", "object", "put", key, "--remote", "--file", path.join(ROOT, m.archive)]);
        } catch (e) {
          fails.push(`${m.id}: ${(e.stderr ?? e.message ?? "").toString().slice(-200)}`);
        }
      }
    }),
  );
  if (fails.length) {
    for (const f of fails) console.error(`✗ R2 ${f}`);
    console.error(`\n${fails.length} R2 upload(s) failed — DB not updated`);
    process.exit(1);
  }
  console.log(`R2: ${manifest.length} archive(s) uploaded`);
}

// ── D1 upserts (content columns only on conflict) ───────────────────────────
const esc = (s) => String(s).replace(/'/g, "''");
const i18nSql = (m) => {
  const a = [];
  if (m.name_zh) a.push(`'$.zh.name', '${esc(m.name_zh)}'`);
  if (m.description_zh) a.push(`'$.zh.description', '${esc(m.description_zh)}'`);
  return a.length ? `json_set('{}', ${a.join(", ")})` : "NULL";
};

let fi = 0;
let out = "";
let n = 0;
const sqlFiles = [];
const flush = () => {
  if (!out) return;
  const f = path.join(BUILD, `batch-${String(++fi).padStart(3, "0")}.sql`);
  fs.writeFileSync(f, out);
  sqlFiles.push(f);
  out = "";
  n = 0;
};
for (const m of manifest) {
  out += `INSERT INTO catalog_entries
(id, version, display_name, description, icon, source_type, source_url, sha256,
 type, kind, visibility, credits_per_use, category, required_plan, i18n, updated_at)
VALUES
('${esc(m.id)}', '${esc(m.version)}', '${esc(m.name)}', '${esc(m.description)}',
 NULL, 'tar.gz', '${esc(m.source_url)}', '${m.sha256}',
 '${m.type}', 'byoa', 'public', 0, '${esc(m.category)}', NULL, ${i18nSql(m)}, datetime('now'))
ON CONFLICT(id, version) DO UPDATE SET
  display_name = excluded.display_name, description = excluded.description,
  source_type = excluded.source_type, source_url = excluded.source_url, sha256 = excluded.sha256,
  type = excluded.type, kind = excluded.kind, category = excluded.category,
  i18n = excluded.i18n, updated_at = excluded.updated_at;
`;
  if (++n >= SQL_CHUNK) flush();
}
flush();
console.log(dryRun ? `dry-run: ${sqlFiles.length} SQL batch file(s) for ${manifest.length} row(s), no writes` : `D1: ${sqlFiles.length} batch file(s)`);
if (!dryRun) {
  for (const f of sqlFiles) wrangler(["d1", "execute", D1_DATABASE, "--remote", "--file", f]);
}

// ── verify ──────────────────────────────────────────────────────────────────
if (dryRun) {
  for (const m of manifest.slice(0, 5)) console.log(`  would publish ${m.id} (${m.type}/${m.category}) sha=${m.sha256.slice(0, 12)}…`);
  process.exit(0);
}

// 1. D1 rows match the manifest exactly (id → sha256/content columns).
const idList = manifest.map((m) => `'${esc(m.id)}'`).join(",");
const rows = d1(["--command", `SELECT id, sha256, type, category FROM catalog_entries WHERE id IN (${idList})`]);
const bad = [];
const d1sha = new Map(rows.map((r) => [r.id, r]));
for (const m of manifest) {
  const r = d1sha.get(m.id);
  if (!r) bad.push(`${m.id}: missing in D1 after upsert`);
  else if (r.sha256 !== m.sha256) bad.push(`${m.id}: sha256 drift D1=${r.sha256} local=${m.sha256}`);
  else if (r.type !== m.type) bad.push(`${m.id}: type drift`);
  else if (r.category !== m.category) bad.push(`${m.id}: category drift`);
}
if (bad.length) {
  for (const b of bad) console.error(`✗ ${b}`);
  process.exit(1);
}
console.log(`✓ D1 matches manifest for ${manifest.length} id(s)`);

// 2. sample archive downloads — R2 bytes must equal the D1 sha256.
const samples = [manifest[0], manifest[Math.floor(manifest.length / 2)], manifest[manifest.length - 1]];
for (const m of samples) {
  const res = await fetch(m.source_url);
  if (!res.ok) {
    console.error(`✗ sample download ${m.id}: HTTP ${res.status}`);
    process.exit(1);
  }
  const { createHash } = await import("node:crypto");
  const got = createHash("sha256").update(Buffer.from(await res.arrayBuffer())).digest("hex");
  if (got !== m.sha256) {
    console.error(`✗ sample sha mismatch ${m.id} (R2 ${got.slice(0, 12)}…, expected ${m.sha256.slice(0, 12)}…)`);
    process.exit(1);
  }
  console.log(`✓ sample archive ok: ${m.id}`);
}

// 3. catalog ETags: en vs zh distinct + 304 round-trip.
//    GET, not HEAD — the worker's catalog handler only synthesizes ETags on GET.
//    accept-encoding: identity — compressed responses get their strong ETag
//    rewritten to weak (W/"…") by Cloudflare, which the handler's strict
//    If-None-Match comparison then never matches (→ 200 instead of 304).
//    Retried: bulk writes just landed, allow reads to settle.
const CATALOG = process.env.CATALOG_BASE_URL ?? "https://api.syscity.net";
const etagOf = async (url) => {
  const r = await fetch(url, { headers: { "accept-encoding": "identity" } });
  await r.arrayBuffer(); // drain the body; we only need headers
  return r.headers.get("etag");
};
let etagOk = false;
let etagErr = "";
for (let attempt = 1; attempt <= 3 && !etagOk; attempt++) {
  if (attempt > 1) await new Promise((r) => setTimeout(r, 5000));
  const ee = await etagOf(`${CATALOG}/catalog.json`);
  const ez = await etagOf(`${CATALOG}/catalog.json?lang=zh`);
  if (!ee || !ez || ee === ez) {
    etagErr = `en/zh ETags not distinct (${ee} / ${ez})`;
    continue;
  }
  if (ee.startsWith("W/")) {
    etagErr = `weak ETag came back despite identity encoding (${ee})`;
    continue;
  }
  const code = await fetch(`${CATALOG}/catalog.json`, {
    headers: { "accept-encoding": "identity", "if-none-match": ee },
  }).then((r) => r.status);
  if (code !== 304) {
    etagErr = `expected 304 with If-None-Match, got ${code}`;
    continue;
  }
  console.log(`✓ catalog ETags distinct + 304 (${ee} / ${ez})`);
  etagOk = true;
}
if (!etagOk) {
  console.error(`✗ ${etagErr}`);
  process.exit(1);
}
console.log("publish verified");
