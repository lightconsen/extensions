#!/usr/bin/env node
/** Regenerate index/catalog.json from entries/ + .build/manifest.jsonl.
 *
 * Mirrors the live /catalog.json entry shape (public view, kind=byoa).
 * sha256 comes from the pack manifest — run pack.mjs first. `updated_at` is
 * intentionally omitted: the repo index is a human-facing aggregate, while
 * liveness fields remain owned by the runtime D1 store.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseMeta, archiveUrl } from "./lib.mjs";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENTRIES = path.join(ROOT, "entries");

const manFile = path.join(ROOT, ".build", "manifest.jsonl");
const shas = fs.existsSync(manFile)
  ? new Map(fs.readFileSync(manFile, "utf8").split("\n").filter(Boolean).map((l) => {
      const m = JSON.parse(l);
      return [m.id, m.sha256];
    }))
  : new Map();

const connectors = [];
for (const id of fs.readdirSync(ENTRIES).sort()) {
  const dir = path.join(ENTRIES, id);
  if (!fs.statSync(dir).isDirectory()) continue;
  const meta = parseMeta(fs.readFileSync(path.join(dir, "meta.yaml"), "utf8"));
  const version = meta.version ?? "1.0.0";
  connectors.push({
    id,
    version,
    display_name: meta.name ?? "",
    description: meta.description ?? "",
    icon: null,
    type: meta.type ?? "expert",
    kind: "byoa",
    visibility: "public",
    credits_per_use: 0,
    category: meta.category ?? null,
    source: { type: "tar.gz", url: archiveUrl(id, version) },
    sha256: shas.get(id) ?? null,
    auto_update: false,
    i18n: meta.i18n?.zh ? { zh: { name: meta.i18n.zh.name ?? null, description: meta.i18n.zh.description ?? null } } : null,
  });
}

// connectors/ — cloud-relay registry entries (kind=cloud, no archive).
const CONNECTORS = path.join(ROOT, "connectors");
if (fs.existsSync(CONNECTORS)) {
  for (const id of fs.readdirSync(CONNECTORS).sort()) {
    const dir = path.join(CONNECTORS, id);
    if (!fs.statSync(dir).isDirectory()) continue;
    const meta = parseMeta(fs.readFileSync(path.join(dir, "meta.yaml"), "utf8"));
    connectors.push({
      id,
      version: meta.version ?? "1.0.0",
      display_name: meta.name ?? "",
      description: meta.description ?? "",
      icon: null,
      type: "connector",
      kind: "cloud",
      visibility: "public",
      credits_per_use: 0,
      category: meta.category ?? null,
      source: { type: "mcp", url: meta.connector?.url ?? "" },
      sha256: null,
      auto_update: false,
      i18n: meta.i18n?.zh ? { zh: { name: meta.i18n.zh.name ?? null, description: meta.i18n.zh.description ?? null } } : null,
    });
  }
}

const out = path.join(ROOT, "index", "catalog.json");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify({ version: 1, connectors }, null, 2) + "\n");
console.log(`index regenerated: ${connectors.length} entries → index/catalog.json`);
