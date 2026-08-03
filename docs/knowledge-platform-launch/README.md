# 知识平台上线工作区

| 字段 | 内容 |
|---|---|
| 状态 | 执行中 |
| 当前分支 | `feat/company-library-demo` |
| 当前阶段 | 公司知识库 Demo 数据与业务纵切 |
| 下一产品交付 | 可登录、可部署的 8 家公司知识库 |
| 生产发布 | 已授权；外部凭据仍是实际部署门禁 |
| 更新日期 | 2026-08-04 |

本目录是“知识平台产品上线”的 GitHub 总入口，记录已批准的产品优先级、UAT 边界、数据就绪策略和交付顺序。它不重复每个 Codex Task 的逐行实现步骤；可执行的精确步骤仍以 `docs/superpowers/plans/` 中的当前计划为准。

## 已批准的产品方向

- 首个可用环境是需登录的内部 UAT，预计 10–20 名测试用户，不是公开生产站。
- 第一阶段所有已登录用户均拥有内容查看权限；不由角色名称隐式推导权限。
- 左侧栏只有三个业务入口：`首页`、`公司信息库`、`行业报告库`。
- 首个业务纵切是公司信息库，优先使用仓库已有的 Shell、BP、ExxonMobil、Petronas、ADNOC、Chevron、ENI 和 TotalEnergies 数据。
- 行业报告库在附件未上传时只展示可验证的元数据和“附件未提供”状态，不伪造 PDF 或下载能力。
- 先完成 Foundation Task 1A–10，再实施公司 UAT 纵切，之后扩展报告、搜索、工作流和管理能力。

## 文档导航

1. [`01-launch-strategy.md`](01-launch-strategy.md) — 环境、产品边界、执行原则和停止条件。
2. [`02-uat-scope-and-acceptance.md`](02-uat-scope-and-acceptance.md) — 第一个可用版本的功能、页面顺序和验收证据。
3. [`03-data-readiness.md`](03-data-readiness.md) — 现有 GitHub 资产、数据缺口、导入原则和权利约束。
4. [`04-delivery-roadmap.md`](04-delivery-roadmap.md) — 从 Foundation 到内部 UAT、再到生产验收的交付顺序。

## 五层权威链

1. PRD：`docs/product/PRD.md`
2. Product/System Design：`docs/product/system-design.md`
3. Technical Architecture：`docs/architecture/technical-architecture.md`
4. Roadmap：`docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`
5. Codex Implementation Plan：`docs/superpowers/plans/2026-07-30-platform-foundation.md` 及后续产品域计划

`docs/product/acceptance-criteria.md` 是 PRD 下属的四层验收标准。本目录只汇总已批准的上线策略，不得覆盖 PRD 或精确 Implementation Plan。
