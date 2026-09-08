#!/usr/bin/env node
/** Pack every entry into .build/archives/<id>.tar.gz + .build/manifest.jsonl.
 *
 * Archives are reproducible: GNU tar with fixed mtime/owner + `gzip -n`.
 * CI (ubuntu) is the publishing authority; on macOS the BSD tar fallback
 * produces a valid but differently-hashed archive — fine for local smoke,
 * never publish from a Mac.
 *
 * Usage: node scripts/pack.mjs [--only RE]
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMeta, archiveUrl } from "./lib.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENTRIES = path.join(ROOT, "entries");
const BUILD = path.join(ROOT, ".build");
const ARCHIVES = path.join(BUILD, "archives");

const only = process.argv.includes("--only") ? new RegExp(process.argv[process.argv.indexOf("--only") + 1]) : null;

const isGnuTar = (() => {
  try {
    return execFileSync("tar", ["--version"], { encoding: "utf8" }).includes("GNU");
  } catch {
    return false;
  }
})();

fs.mkdirSync(ARCHIVES, { recursive: true });
const manifest = [];

for (const id of fs.readdirSync(ENTRIES).sort()) {
  const dir = path.join(ENTRIES, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  if (only && !only.test(id)) continue;
  const meta = parseMeta(fs.readFileSync(path.join(dir, "meta.yaml"), "utf8"));
  const out = path.join(ARCHIVES, `${id}.tar.gz`);
  const flags = isGnuTar
    ? ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-cf", "-", "-C", ENTRIES, id]
    : ["-cf", "-", "-C", ENTRIES, id];
  const tar = execFileSync("tar", flags, { maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "inherit"] });
  const gz = execFileSync("gzip", ["-n"], { input: tar, maxBuffer: 32 * 1024 * 1024 });
  fs.writeFileSync(out, gz);
  manifest.push({
    id,
    type: meta.type,
    version: meta.version,
    category: meta.category,
    name: meta.name,
    description: meta.description,
    name_zh: meta.i18n?.zh?.name ?? null,
    description_zh: meta.i18n?.zh?.description ?? null,
    archive: `.build/archives/${id}.tar.gz`,
    sha256: createHash("sha256").update(gz).digest("hex"),
    source_url: archiveUrl(id, meta.version),
  });
}

fs.writeFileSync(path.join(BUILD, "manifest.jsonl"), manifest.map((m) => JSON.stringify(m)).join("\n") + "\n");
console.log(`packed ${manifest.length} archive(s) → .build/archives (${isGnuTar ? "reproducible" : "BSD tar — local smoke only, do not publish"})`);
