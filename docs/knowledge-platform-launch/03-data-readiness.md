# 数据就绪与导入策略

## 1. 上传时机结论

基础框架完成前可以开始数据盘点、清洗、字段映射和导入排练，但不应把仓库原始 JSON/Excel/HTML 直接当作最终网站主数据。过早的直接上传会带来重复公司、不稳定 ID、单位/币种混淆、来源丢失和后续 schema 迁移成本。

推荐的安全并行工作是：

1. 保留原始文件不变，记录文件路径、hash、来源、权利类型和安全等级。
2. 建立公司稳定 ID 和别名映射，例如 `exxonmobil` 与历史文件的 `exxon` 不能生成两家公司。
3. 建立版本化 staging manifest，验证字段、单位、期间、空值和关联。
4. Foundation 完成后通过可重跑、可幂等、有错误报告的导入程序写入 PostgreSQL。
5. 附件只在权利和安全属性审核后进入私有 R2，不进入 Web 公开 assets。

## 2. 重点公司资产矩阵

当前公司基础档案源包含 126 家公司；其中 68 家可与项目地图数据精确关联，8 家重点公司具备完整项目、产量和财务模块。页面使用 `完整 Portfolio`、`项目数据`、`公司档案` 三种状态明确数据覆盖范围。

| 公司 | 稳定标识 | 简介 | Banner | 地图数据 | 产量 | 财务 |
|---|---|---:|---:|---:|---:|---:|
| Shell | `shell` | 有 | 有 | 有 | 有 | 有 |
| BP | `bp` | 有 | 有 | 有 | 有 | 有 |
| ExxonMobil | `exxonmobil` | 有 | 有 | 有 | 有（原文件别名 `exxon`） | 有 |
| Petronas | `petronas` | 有 | 有 | 有 | 有 | 有 |
| ADNOC | `adnoc` | 有 | 有 | 有 | 有 | 有 |
| Chevron | `chevron` | 有 | 有 | 有 | 有 | 有 |
| ENI | `eni` | 有 | 有 | 有 | 有 | 有 |
| TotalEnergies | `totalenergies` | 有 | 有 | 有 | 有 | 有 |

主要现有路径：

- 公司简介：`company-text-dashboard/data/company-data.json`
- Banner：`<slug>-banner.html`
- 地图：`maps/data/<slug>.json`
- 财务：`data/<slug>-financials.json`
- 产量：`data/<slug>-net-production-by-region.json`；ExxonMobil 的历史路径为 `data/exxon-net-production-by-region.json`

机器可校验的清单已生成在 `data/company-demo-inventory.json`，由
`scripts/build-company-demo-inventory.mjs` 从原始资料重新计算文件大小和 SHA-256。
`node scripts/build-company-demo-inventory.mjs --check` 会拒绝缺失或过期的清单。
原始文件保持不变；该矩阵和清单只证明来源存在，不等于已完成内容、数值口径、版权或产品验收。

## 3. 标准化最低要求

每个发布数据集至少记录：

- 稳定对象 ID 和来源记录 ID。
- 来源路径/URL、导入版本、导入时间和内容 hash。
- 权利类型、安全等级、核验状态和最后核验时间。
- 指标名称、数值、单位、币种、期间、地域和空值原因。
- 别名和关联规则，不依赖展示名称进行模糊合并。

导入必须默认拒绝未知字段、非法单位和无法解析的期间；不能静默丢弃错误行。

## 4. 报告与新闻边界

统一报告目录的版本化源文件是 `data/report-sources/rystad-upstream-test.xlsx` 和 `data/report-sources/research-reports-test.xlsx`，由 `scripts/build-report-catalog.mjs` 生成 `data/report-catalog.json`。由于用户已确认 PDF 等附件尚未上传：

- 不根据 `format: "PDF"` 推断附件存在。
- 附件存在性必须通过受测试的 manifest/R2 记录确认。
- 没有附件时不渲染可用的预览或下载按钮。
- 相关公司使用稳定 ID/别名表关联，不靠子串命中。
- 新闻只显示仓库中实际存在且可追溯的项；无数据时不伪造内容。

当前目录包含 1,111 条元数据和 642 条精确公司关联，全部已进入受 RLS 保护的 PostgreSQL 表；附件均标记为未上传。来源类别仅保留“行业研究”和“公司披露”，原“来源”字段统一为“发布机构”，区域字段保留。四个报告类型及数量为：行业研究报告 741、财务报告 207、年度综合报告 102、ESG 与可持续发展报告 61。

已知源数据缺口也作为质量事实保留：722 条公司披露未提供发布日期和区域，因此日期为缺失、区域显示“未标注”，不会根据标题猜测。可运行 `node scripts/build-report-catalog.mjs --check` 校验标准化结果，运行 `node scripts/sync-report-catalog.mjs` 以单事务批量同步目录和公司关联。

报告附件的存储职责固定为：private R2 保存 PDF/PPTX/XLSX 原件，PostgreSQL 保存 object key、hash、MIME、大小、来源、权利/审核状态和关联。首批通过 manifest 批量导入，不要求逐个手工上传；管理端单文件上传入口在报告附件产品域中后续实现。

## 5. 对最终效果的影响

只要原始文件保留不变、导入可重跑、主数据身份稳定，早期 staging 和 UAT 上传不会损害最终效果。如果跳过这些保护，后续架构会被历史文件命名和临时字段反向绑定，且返工会随数据量增长。
