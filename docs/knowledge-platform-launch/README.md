# 知识平台上线工作区

| 字段 | 内容 |
|---|---|
| 状态 | 执行中 |
| 当前分支 | `feat/cloud-uat-readiness` |
| 当前阶段 | 参考 UI 修正与 Cloudflare 内部 UAT 建设 |
| 当前产品交付 | 可直接本地进入、可检索的 126 家公司档案、8 家完整 Portfolio 和 24 条报告元数据 |
| 生产发布 | 已授权；外部凭据仍是实际部署门禁 |
| 更新日期 | 2026-08-04 |

本目录是“知识平台产品上线”的 GitHub 总入口，记录已批准的产品优先级、UAT 边界、数据就绪策略和交付顺序。它不重复每个 Codex Task 的逐行实现步骤；可执行的精确步骤仍以 `docs/superpowers/plans/` 中的当前计划为准。

## 已批准的产品方向

- 首个可用环境是由 Cloudflare Access 保护的内部 UAT，预计 10–20 名测试用户并进行 20–100 并发只读验收，不是公开生产站。
- 第一阶段所有已登录用户均拥有内容查看权限；不由角色名称隐式推导权限。
- 左侧栏只有三个业务入口：`首页`、`公司信息库`、`行业报告库`。
- 公司信息库展示仓库全部 126 家真实档案；Shell、BP、ExxonMobil、Petronas、ADNOC、Chevron、ENI 和 TotalEnergies 提供完整 Portfolio，其余公司按来源能力渐进展示。
- 行业报告库在附件未上传时只展示可验证的元数据和“附件未提供”状态，不伪造 PDF 或下载能力。
- Foundation Task 1A–10 已完成；公司 UAT、报告元数据档案和客户端全站检索已完成本地代码与数据验收，之后扩展附件、工作流和管理能力。

## 当前 Demo 证据

- 126 家公司、234 条可追溯资产记录、24 条报告元数据和 27 条公司关联已通过可重跑 seed 进入 PostgreSQL。
- 68 家公司具备项目地图数据；8 家重点公司具备项目、产量和财务的完整 Portfolio。
- 本地自动只读身份、只读 RLS、Cloudflare Access JWT 验证、公司/报告列表与详情 API、全站检索和受保护图表资源已接通；可见邮箱快速入口已撤下。
- Shell 验收样本的 4 个嵌入模块均在真实浏览器加载；公司 Banner 已改为原生响应式组件，地图统计为 552 个项目。
- 报告附件与新闻缺失均明确显示，不生成虚假内容、研究结论、目录或下载能力。
- Cloudflare 构建已通过 dry-run；生产发布仍需真实 Hyperdrive、Supabase/R2 与 Cloudflare 凭据。

## 文档导航

1. [`01-launch-strategy.md`](01-launch-strategy.md) — 环境、产品边界、执行原则和停止条件。
2. [`02-uat-scope-and-acceptance.md`](02-uat-scope-and-acceptance.md) — 第一个可用版本的功能、页面顺序和验收证据。
3. [`03-data-readiness.md`](03-data-readiness.md) — 现有 GitHub 资产、数据缺口、导入原则和权利约束。
4. [`04-delivery-roadmap.md`](04-delivery-roadmap.md) — 从 Foundation 到内部 UAT、再到生产验收的交付顺序。
5. [`05-cloud-uat-runbook.md`](05-cloud-uat-runbook.md) — Supabase、Hyperdrive、private R2、Cloudflare Access、负载和报告附件的操作边界。

## 五层权威链

1. PRD：`docs/product/PRD.md`
2. Product/System Design：`docs/product/system-design.md`
3. Technical Architecture：`docs/architecture/technical-architecture.md`
4. Roadmap：`docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`
5. Codex Implementation Plan：`docs/superpowers/plans/2026-07-30-platform-foundation.md` 及后续产品域计划

`docs/product/acceptance-criteria.md` 是 PRD 下属的四层验收标准。本目录只汇总已批准的上线策略，不得覆盖 PRD 或精确 Implementation Plan。
