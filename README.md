# syscity extensions 目录

syscity 市场的**公开目录内容源仓库**（source of truth）。每条 expert（专家）和 skill（技能）是 `entries/<id>/` 下的一个目录；merge 到 main 后 CI 自动打包发布到线上市场。

**线上目录**：`https://api.syscity.net/catalog.json` · **引擎侧市场页**：syscity app 内置市场

# The syscity extensions catalog

Source of truth for the public syscity marketplace catalog. Each expert/skill lives in `entries/<id>/`; CI packs and publishes to the live catalog on merge to `main`.

## 数据流（拆开存，合并发）

```
entries/<id>/          ← 真相源：人只改这里（PR 拆开评审）
     │  scripts/pack.mjs + publish.mjs（CI on merge）
     ▼
R2 归档 + D1 catalog_entries  ← 运行时存储（catalog.json / /archives 路由）
     │
     └── index/catalog.json  ← 生成的聚合视图，供人工总览（勿手编）
```

- **仓库管内容**：SOUL/SKILL 正文、名称与描述（含中文）、分类、license、来源。
- **运行时字段不在仓库里**：`visibility`、`credits_per_use`、`required_plan` 由云端 `ops catalog set` 管理，PR 不改。
- 线上 `catalog.json` 契约不变（引擎全量同步）；本仓库 `index/catalog.json` 只是镜像视图。

## Entry 结构

```
entries/ws-backend-architect/
├── meta.yaml          # 目录元数据（id/type/version/category/license/来源/中文翻译）
├── SOUL.md            # expert 正文（frontmatter: name/persona/voice/... + 角色 prompt）
│   └── 或 SKILL.md    # skill 正文（frontmatter: name/description + 使用说明）+ references/
├── LICENSE            # 上游 license 原文
└── ATTRIBUTION.md     # 来源路径、上游 commit、license
```

完整字段说明见 [CONTRIBUTING.md](CONTRIBUTING.md)；模板在 [templates/entry/](templates/entry/)。

## 贡献

1. Fork → 建分支 → 复制 `templates/entry/` → 填内容
2. 本地校验（可选，CI 会跑）：`node scripts/validate.mjs`
3. 开 PR → review（license 与内容审查是主闸门）→ merge
4. CI 自动：validate → 可复现打包 → 上传 R2 → D1 upsert → verify → 重生成 index

删除条目不走 PR（无法自动下架），联系维护者。License 必须在 allowlist 内（MIT / Apache-2.0 / BSD / ISC / MPL-2.0 / CC0 / CC-BY-4.0）。

## 脚本

| 命令 | 作用 |
|---|---|
| `node scripts/validate.mjs` | 校验全部 entry（布局/元数据/license/卫生） |
| `node scripts/pack.mjs [--only RE]` | 可复现打包 → `.build/`（GNU tar 固定 mtime + `gzip -n`） |
| `node scripts/publish.mjs [--dry-run] [--changed]` | 发布到 R2+D1（只更新内容列）+ verify |
| `node scripts/gen-index.mjs` | 重新生成 `index/catalog.json` |

发布需要 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`（CI secrets）；macOS 本地打包仅作冒烟，不作为发布基准。

## License

仓库工具件（scripts、workflows、文档）Apache-2.0。**每条 entry 内容归属其上游 license**，见各自目录内的 `LICENSE` 与 `meta.yaml`。

## English

Source of truth for the public syscity marketplace catalog. One directory per entry under `entries/<id>/` (`meta.yaml` + `SOUL.md`/`SKILL.md` + `LICENSE` + `ATTRIBUTION.md`). CI validates, packs reproducibly, and publishes to R2 + D1 on merge; runtime fields (visibility/credits) stay in the cloud, not in this repo. Contributions: see CONTRIBUTING.md — upstream license must be on the allowlist, zh translation required, one PR per entry.
