**English** | [简体中文](docs/CONTRIBUTING.zh-CN.md)

# Contributing

One PR per entry (or one tight set of related entries). Merging to `main` auto-publishes to the live marketplace, so review is the only gate before release.

## 1. Directory structure

```
entries/<id>/
├── meta.yaml          # required — catalog metadata
├── SOUL.md            # required for type=expert (SKILL.md must not coexist)
│   or SKILL.md        # required for type=skill (may ship references/ etc.)
├── LICENSE            # required — upstream license, verbatim
└── ATTRIBUTION.md     # required — provenance
```

`<id>` rules: `^[a-z0-9][a-z0-9-]{1,63}$` (dots tolerated for legacy ids), unique across the repo. Prefix conventions: `ws-` (wshobson), `lobe-` (LobeHub), `anthropic-` (Anthropic official), `<vendor>-` (other vendor officials). Original in-house content needs no prefix.

## 2. meta.yaml fields

```yaml
id: ws-backend-architect       # must equal the directory name
type: expert                   # expert | skill
version: 1.0.0                 # semver
category: engineering          # see allowlist below
name: Backend Architect        # display name (English base column)
description: ...               # ≤2000 chars; for experts include trigger conditions ("Use when...")
license: MIT                   # see License policy
source:
  repo: https://github.com/wshobson/agents   # must be a github.com URL
  commit: 3097abe              # upstream commit (7-40 hex); "unknown" allowed with a warning
  paths:                       # upstream source paths (one or more)
    - agents/backend-architect.md
i18n:
  zh:
    name: 后端架构师            # required
    description: ...           # required
```

**Category allowlist** (8, matching the live marketplace):

| slug | fits |
|---|---|
| `engineering` | development, architecture, DevOps, cloud platforms |
| `data-ai` | data engineering, ML, LLM applications |
| `security` | security auditing, threat modeling, compliance |
| `design` | UI/UX, visual, frontend aesthetics |
| `content-writing` | copywriting, translation, docs, social media |
| `business` | product, growth, marketing, careers |
| `research-education` | research, academia, tutoring |
| `specialized-domains` | verticals (finance, legal, medical, hardware…) |

Scalar style: bare words are fine; anything with spaces/colons/non-ASCII must be a double-quoted JSON string (`"..."`). The parser only supports this subset — no real YAML syntax (anchors, block scalars, multiline).

## 3. License policy

`license:` accepts only (SPDX): `MIT`, `Apache-2.0`, `BSD-2-Clause`, `BSD-3-Clause`, `ISC`, `MPL-2.0`, `CC0-1.0`, `CC-BY-4.0`, `Unlicense`.

- **No license or off-list license → validation fails** (popular no-license repos are common — don't "import first, ask later")
- Put the upstream license text in `LICENSE`; record source paths and the upstream commit in `ATTRIBUTION.md`
- GPL/AGPL/SSPL and every source-available / custom license are rejected
- Adapted content: describe your changes; the license follows the upstream one

## 4. Content requirements

- `SOUL.md`/`SKILL.md` bodies stay faithful to upstream (that's the value); formatting tweaks only — no extra injected instructions
- Never include: keys/tokens/personal data, prompts steering users toward paid APIs, links to non-https endpoints
- Automatic heuristics scan for prompt-injection patterns (`ignore previous instructions` etc.) — hits are warnings only; human review is the real gate
- Chinese translation is mandatory (`i18n.zh`); machine translation is acceptable if semantically accurate

## 5. Publishing and the runtime boundary

| This repo (content) | Runtime (cloud — PRs can't change) |
|---|---|
| SOUL/SKILL bodies | `visibility` (public/hidden) |
| name/description + zh | `credits_per_use` |
| category, license, provenance | `required_plan`, takedown/deletion |
| version | usage stats |

Runtime fields are managed via the syscity-cloud `ops catalog set`.

## 6. Deletion / takedown

PR-deleting a directory does **not** remove the live entry (D1 has no delete path). Contact a maintainer for takedowns.

## 7. Local validation (optional)

```bash
node scripts/validate.mjs   # CI runs this on every PR
node scripts/pack.mjs       # reproducible pack smoke test
```
