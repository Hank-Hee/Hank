# Cloudflare 初上线运行手册

## 目标架构

初上线使用公开只读应用入口：浏览器可匿名读取公司目录、公司详情、报告元数据和已发布看板；写入、管理、用户上下文与附件接口不公开。Worker 使用固定、不可由客户端覆盖的只读数据库身份，经 Hyperdrive 连接新加坡区域的 Supabase PostgreSQL。两个 private R2 桶分别保存已发布附件和隔离区文件，浏览器不能直接获得数据库连接或 R2 公共地址。

本地开发不显示邮箱登录入口。只有 `DEMO_AUTH_ENABLED=true` 的本地 Worker 会自动映射到固定只读身份；UAT 和后续环境不会启用该变量。

当前阶段不在应用入口启用 Cloudflare Access，避免公开站点与 Worker 应用层认证状态不一致导致“页面存在但数据为 0”。Access 验证代码保留待后续账号阶段启用；届时再建立邮箱允许列表、会话、注销、审计与越权测试。数据库、Hyperdrive 和 R2 不因网站公开而公开。

## 资源和密钥边界

| 资源 | UAT 名称/规则 | 存放内容 |
|---|---|---|
| PostgreSQL | Supabase 新加坡独立项目 | 公司、报告元数据、关联、权限、R2 object key、hash、MIME、大小和状态 |
| R2 published | `wison-knowledge-files-uat` | 审核通过的 PDF、PPTX、XLSX 等原件 |
| R2 quarantine | `wison-knowledge-quarantine-uat` | 待校验或不合格文件，不对普通用户提供读取 |
| Hyperdrive | 创建后把真实 binding ID 写入 UAT 配置 | Worker 到 PostgreSQL 的连接池和加速层 |
| Cloudflare Access | 初上线暂停，账号阶段恢复 | 后续人员身份和入口策略 |

所有平台令牌、数据库密码、Access 服务令牌都只写入平台 secret、系统钥匙串或临时环境变量，不提交 Git。Cloudflare/Supabase 登录使用对应平台账号，不使用 Mac 开机密码。

## 一次性建设顺序

1. 运行 `wrangler login` 和 `supabase login` 完成浏览器授权。
2. 在 Supabase 新加坡区域创建 UAT 项目，执行 `supabase/roles.sql`、全部 migration 和幂等 seed。
3. 运行 `wrangler r2 bucket create wison-knowledge-files-uat` 与 `wrangler r2 bucket create wison-knowledge-quarantine-uat`。R2 默认保持私有，不配置 `r2.dev` 或自定义公开域名。
4. 使用 Supabase 的 IPv4 session pooler 连接串创建 Hyperdrive，并把返回的真实 ID 作为 `HYPERDRIVE` binding 写入 `apps/api/wrangler.jsonc` 的 `env.uat`。
5. 在 UAT Worker 明确配置 `PUBLIC_READ_ONLY=true`，且不配置 Access AUD、team domain 或邮箱名单。
6. 构建并部署 Worker，确认入口没有残留的 Access 策略重定向。
7. 先完成公开 GET、受保护 `/api/v1/me`、无写入接口、R2 私有性检查，再进行人员和负载验收。

不得把 Supabase 连接串或 R2 密钥写进前端；公开范围只限版本化的只读公司/报告 API 和看板资源。

## 20–200 并发只读验收

真实人员用浏览器完成三项导航、公司筛选、完整/部分公司详情和报告元数据任务。公开只读阶段直接对 HTTPS 入口运行负载：

```bash
npm run uat:load -- --base-url https://wison-knowledge-platform.wison.workers.dev --concurrency 20 --requests 200
npm run uat:load -- --base-url https://wison-knowledge-platform.wison.workers.dev --concurrency 50 --requests 500
npm run uat:load -- --base-url https://wison-knowledge-platform.wison.workers.dev --concurrency 100 --requests 1000
npm run uat:load -- --base-url https://wison-knowledge-platform.wison.workers.dev --concurrency 200 --requests 2000
```

门禁为：只发 GET；API p95 小于 800 ms；错误率小于 1%；公司与报告读取匿名返回 200；`/api/v1/me` 匿名返回 401；R2 没有公共域名或公开对象路由；桌面 Chrome/Edge 和移动页面首个可交互目标小于 3.5 秒。200 是“同时执行典型只读浏览路径的用户数”口径，不是 200 RPS；API 压测作为更保守的连接上限验证，仍需真实浏览器任务复核。负载工具最多记录前 10 个失败摘要，不输出任何 secret。

公开初上线期间禁止搜索引擎收录：静态页面同时返回 HTML robots meta 和 `X-Robots-Tag: noindex, nofollow, noarchive`，`robots.txt` 对全部爬虫声明 `Disallow: /`；Worker API 也返回 `X-Robots-Tag`。这些只是索引控制，不替代身份认证或数据分级。

## 行业报告附件

附件不放 PostgreSQL，也不放 Web public assets。原始文件进入 private R2；PostgreSQL 只保存报告 ID、object key、SHA-256、MIME、文件大小、来源、权利状态、审核状态和关联公司。

首批附件采用 manifest 驱动的批量导入：程序计算 hash、校验扩展名/MIME、先写 quarantine、通过后复制到 published 并在一个数据库事务中更新元数据。用户不需要逐个手工上传。后续管理端再提供单文件上传和审核界面；在该链路完成前，现有报告页面继续诚实显示“附件未上传”。

附件预检已可用，支持 PDF、XLS/XLSX、PPT/PPTX。先复制 `data/report-attachments/manifest.example.json`，把真实文件统一放进一个不提交 Git 的本地目录，再运行：

```bash
npm run attachments:prepare -- \
  --manifest=/绝对路径/manifest.json \
  --attachments-root=/绝对路径/附件目录 \
  --output=work/report-attachment-batches/批次.prepared.json
```

预检会拒绝未知/重复报告 ID、目录逃逸、符号链接、空文件、超过 250 MiB 的文件、不支持的扩展名、错误文件签名、未批准权利类型或审核状态，并生成 SHA-256、MIME、大小及 quarantine/published 对象键。生成 prepared manifest 仍不代表附件已发布；真实文件和平台上传凭据到位后，才执行 private R2 quarantine、内容安全检查、published 复制和 PostgreSQL 单事务确认。

## 后续子域名迁移

公司提供最终子域名后，重新绑定 Worker route、Access 策略和数据库/R2 环境即可，不需要重写前端。若最终以 iframe 内嵌简道云，发布前必须把 CSP `frame-ancestors` 收紧为简道云的准确父域名；UAT 期间继续禁止任意站点嵌入。

## 2026-08-04 执行记录

- Cloudflare 已创建 `wison-knowledge-files-uat` 和 `wison-knowledge-quarantine-uat`，两者均未开启 `r2.dev`，也未绑定公开自定义域名。
- Supabase 已创建新加坡区域 `wison-knowledge-platform-uat`，已正式应用 5 个 migration、角色文件和幂等 seed；远端核验为 126 家公司、8 家重点公司、234 条公司资产、1,111 条报告元数据和 642 条公司关联。
- Cloudflare 已创建 `wison-knowledge-postgres-uat` Hyperdrive，UAT Worker 配置已绑定真实 ID，并关闭 SQL 响应缓存，避免权限上下文或数据更新被缓存混用。
- UAT 已部署到 `https://wison-knowledge-platform.wison.workers.dev`。2026-08-05 初上线切换为公开只读：公司、报告和看板允许匿名 GET，`/api/v1/me`、写入、管理和附件仍不公开。旧的 `wison-knowledge-platform-uat` Worker 已删除，源代码仍可从 Git 恢复。
- GitHub 公司源重新生成后仍为 126 家公司和 8 家完整看板；两张 Excel 源表已归一为 1,111 条目录（741 条行业研究、370 条公司披露）并同步云端。2026-08-04 油气价格刷新已同步至 private R2 的 `market-data/oil-gas-prices/2026-08-04.json` 与 `market-data/oil-gas-prices/latest.json`，远端 SHA-256 与仓库文件一致。
- 2026-08-04 GitHub 财务看板已同步盈利能力双轴更新；公司页“相关新闻”和“相关报告”均使用与产量/财务看板一致的外置章节标题。
- API 已增加 Worker isolate 内 60 秒只读缓存、并发请求去重、报告服务端分页/筛选和 Cloudflare `s-maxage`；看板资源使用边缘缓存，页面只在接近可视区时创建 iframe。响应压缩由 Cloudflare 边缘协商，应用不手动添加编码。
- UAT Worker 明确启用 Workers Caching；公开 GET 按响应 `Cache-Control` 进入边缘缓存，健康检查、错误、用户上下文和未来受保护响应默认 `private, no-store`。
- 必须在 Hyperdrive/Worker 环境以匿名真实数据请求重跑 20/50/100 三档；302、401 或只请求静态壳都不能替代业务 API 验收。
- 当前本地网络对 `workers.dev` 存在 DNS 污染；可信 DNS 返回 Cloudflare 地址且 Access 302 已验证。公司正式子域名到位后应改用自定义域名，避免依赖 `workers.dev`。
- 中英文页面任务和 20/50/100 云端负载仍需在本次部署后重跑并记录。
- 未来恢复账号时，Access 策略与 Worker 验证配置必须同批发布，不能只改其中一层。
- 2026-08-05 已部署公开只读版本 `7da56c26-c67e-4cfe-98dc-a8d425f8447e`。全仓测试、类型、lint、构建、2 个数据库集成测试和 6 个浏览器 E2E 均通过；本地 20/50 并发 p95 分别为 176.8/395.6 ms 且 0% 错误，100 并发 p95 910.4 ms、0% 错误，受 2.7 GHz 四核 Intel / 8 GB 本机吞吐限制未过 500 ms 云端门禁。
- 本机网络继续重置或污染 `workers.dev` 连接，导致部署后直接 HTTP 与远程预览隧道无法完成；Wrangler 生产部署成功且绑定已核验，但真实公网 20/50/100 仍须在可正常访问 Cloudflare 的网络重跑。不得把本机网络失败误记为 Worker 代码失败。
- Cloudflare 在线编辑器对 Wrangler 生成的单文件 bundle 做不完整的 JavaScript/TypeScript 静态推断，可能把 `require`、Node 兼容层和 source map 标成大量 Problems。发布门禁以源码 `lint`/`typecheck`、Wrangler dry-run 和部署结果为准，不在生成的 `index.js` 中手工修复这类提示。

## 后续正式账号

当前不提供站内登录。未来账号阶段优先使用 Supabase Auth 邮箱 Magic Link/OTP 建立用户身份，Worker 校验 JWT 并映射 `profiles`/角色权限；完成越权、会话吊销、审计和账号恢复测试后，再决定是否同时用 Access 保护入口。基础设施管理入口可继续由 Access 保护。
