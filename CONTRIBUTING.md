# Contributing / 贡献指南

一个 PR 一条 entry（或一组紧密相关的 entry）。PR 合入 main 即自动发布到线上市场，所以 review 是发布前唯一的闸门。

## 1. 目录结构

```
entries/<id>/
├── meta.yaml          # 必需 — 目录元数据
├── SOUL.md            # type=expert 必需（SKILL.md 不允许同时出现）
│   或 SKILL.md        # type=skill 必需（可带 references/ 等附属文件）
├── LICENSE            # 必需 — 上游 license 原文
└── ATTRIBUTION.md     # 必需 — 来源与出处
```

`<id>` 规则：`^[a-z0-9][a-z0-9-]{1,63}$`，全仓库唯一。前缀约定：`ws-`（wshobson）、`lobe-`（LobeHub）、`anthropic-`（Anthropic 官方）、`<vendor>-`（厂商官方）。自研内容可不加前缀。

## 2. meta.yaml 字段

```yaml
id: ws-backend-architect       # 必须与目录名一致
type: expert                   # expert | skill
version: 1.0.0                 # semver
category: engineering          # 见下方白名单
name: Backend Architect        # 展示名（英文基准列）
description: ...               # ≤2000 字符；expert 侧建议含触发条件（"Use when..."）
license: MIT                   # 见 License 政策
source:
  repo: https://github.com/wshobson/agents   # 必须是 github.com URL
  commit: 3097abe              # 上游 commit（7-40 hex）；取不到可写 unknown（会警告）
  paths:                       # 上游源文件路径（可多个）
    - agents/backend-architect.md
i18n:
  zh:
    name: 后端架构师            # 必填
    description: ...           # 必填
```

**category 白名单**（8 个，与线上市场一致）：

| slug | 适用 |
|---|---|
| `engineering` | 开发、架构、DevOps、云平台 |
| `data-ai` | 数据工程、ML、LLM 应用 |
| `security` | 安全审计、威胁建模、合规 |
| `design` | UI/UX、视觉、前端美学 |
| `content-writing` | 文案、翻译、文档、社媒 |
| `business` | 产品、增长、营销、求职 |
| `research-education` | 研究、学术、学习辅导 |
| `specialized-domains` | 垂直领域（金融法律医疗硬件…） |

标量写法：单词可裸写；含空格/冒号/非 ASCII 的值一律用双引号 JSON 字符串（`"..."`）。解析器只支持这个子集，不要用真正的 YAML 语法（锚点、多行块等）。

## 3. License 政策

`license:` 只接受（SPDX）：`MIT`、`Apache-2.0`、`BSD-2-Clause`、`BSD-3-Clause`、`ISC`、`MPL-2.0`、`CC0-1.0`、`CC-BY-4.0`、`Unlicense`。

- **无 license 或不在表内 → 校验失败**（no-license 的热门仓库很常见，不要"先收进来再说"）
- `LICENSE` 文件放上游原文；`ATTRIBUTION.md` 写明来源路径与上游 commit
- GPL/AGPL/SSPL 及一切 source-available / 自定义 license 一律不收
- 改编内容：说明改动范围，license 跟随上游

## 4. 内容要求

- `SOUL.md`/`SKILL.md` 正文与上游保持一致（价值所在），只允许格式化调整；不得夹带额外指令
- 不得包含：密钥/token/私人信息、硬编码收费 API 的调用诱导、指向非 https 的外联
- 自动启发式会扫 prompt-injection 模式（`ignore previous instructions` 等），命中只是警告，人工 review 才是主闸门
- 中文翻译必须提供（`i18n.zh`）；机器翻译可接受，语义要准确

## 5. 发布与运行时边界

| 仓库（本 repo） | 运行时（云端，PR 改不了） |
|---|---|
| SOUL/SKILL 正文 | `visibility`（public/hidden） |
| name/description + zh | `credits_per_use` |
| category、license、来源 | `required_plan`、下架/删除 |
| version | 使用统计 |

改运行时字段走 syscity-cloud 的 `ops catalog set`。

## 6. 删除 / 下架

PR 删除目录**不会**下架线上条目（D1 无删除通路）。需要下架请联系维护者在云端操作。

## 7. 本地校验（可选）

```bash
node scripts/validate.mjs   # CI 在 PR 上必跑
node scripts/pack.mjs       # 可复现打包冒烟
```
