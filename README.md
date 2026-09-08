**English** | [简体中文](docs/README.zh-CN.md)

# syscity extensions catalog

Source of truth for the **public syscity marketplace catalog**. Every expert and skill lives in its own directory under `entries/<id>/`; merging to `main` makes CI pack and publish it to the live marketplace.

**Live catalog**: `https://api.syscity.net/catalog.json` · consumed by the syscity app's built-in marketplace

## Data flow (split for review, merged for serving)

```
entries/<id>/          ← source of truth — humans only edit here (one PR per entry)
     │  scripts/pack.mjs + publish.mjs (CI on merge)
     ▼
R2 archives + D1 catalog_entries  ← runtime store (catalog.json + /archives routes)
     │
     └── index/catalog.json  ← generated aggregate for humans (never hand-edited)
```

- **The repo owns content**: SOUL/SKILL bodies, names and descriptions (including Chinese), categories, licenses, provenance.
- **Runtime fields stay out of the repo**: `visibility`, `credits_per_use`, `required_plan` are managed in the cloud via `ops catalog set` — PRs don't touch them.
- The live `catalog.json` contract is unchanged (engine full-sync); `index/catalog.json` in this repo is only a mirror view.

## Entry layout

```
entries/ws-backend-architect/
├── meta.yaml          # catalog metadata (id/type/version/category/license/source/zh i18n)
├── SOUL.md            # expert body (frontmatter: name/persona/voice/… + role prompt)
│   └── or SKILL.md    # skill body (frontmatter: name/description + usage) + references/
├── LICENSE            # upstream license, verbatim
└── ATTRIBUTION.md     # upstream paths, commit, license
```

Field reference in [CONTRIBUTING.md](CONTRIBUTING.md); templates in [templates/entry/](templates/entry/).

## Contributing

1. Fork → branch → copy `templates/entry/` → fill it in
2. Optional local check (CI runs it anyway): `node scripts/validate.mjs`
3. Open a PR → review (license and content review are the gate) → merge
4. CI automatically: validate → reproducible pack → upload R2 → D1 upsert → verify → regenerate index

Deleting an entry does not go through a PR (no automatic takedown) — contact a maintainer. Licenses must be on the allowlist (MIT / Apache-2.0 / BSD / ISC / MPL-2.0 / CC0 / CC-BY-4.0).

## Scripts

| Command | Purpose |
|---|---|
| `node scripts/validate.mjs` | Validate all entries (layout / metadata / license / hygiene) |
| `node scripts/pack.mjs [--only RE]` | Reproducible packing → `.build/` (GNU tar fixed mtime + `gzip -n`) |
| `node scripts/publish.mjs [--dry-run] [--changed]` | Publish to R2+D1 (content columns only) + verify |
| `node scripts/gen-index.mjs` | Regenerate `index/catalog.json` |

Publishing needs `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` (CI secrets); a macOS-local pack is a smoke test only, never the publishing baseline.

## License

Repo tooling (scripts, workflows, docs) is Apache-2.0. **Each entry's content belongs to its upstream license** — see the `LICENSE` and `meta.yaml` in its directory.
