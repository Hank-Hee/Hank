# Cloudflare 内部 UAT 运行手册

## 目标架构

内部 UAT 使用一套独立环境：Cloudflare Access 负责入口身份验证，Worker 验证 `Cf-Access-Jwt-Assertion` 后才允许读取业务 API；Hyperdrive 连接新加坡区域的 Supabase PostgreSQL；两个 private R2 桶分别保存已发布附件和隔离区文件。浏览器不能直接获得数据库连接或 R2 公共地址。

本地开发不显示邮箱登录入口。只有 `DEMO_AUTH_ENABLED=true` 的本地 Worker 会自动映射到固定只读身份；UAT 和后续环境不会启用该变量。

## 资源和密钥边界

| 资源 | UAT 名称/规则 | 存放内容 |
|---|---|---|
| PostgreSQL | Supabase 新加坡独立项目 | 公司、报告元数据、关联、权限、R2 object key、hash、MIME、大小和状态 |
| R2 published | `wison-knowledge-files-uat` | 审核通过的 PDF、PPTX、XLSX 等原件 |
| R2 quarantine | `wison-knowledge-quarantine-uat` | 待校验或不合格文件，不对普通用户提供读取 |
| Hyperdrive | 创建后把真实 binding ID 写入 UAT 配置 | Worker 到 PostgreSQL 的连接池和加速层 |
| Cloudflare Access | 仅允许批准的内部测试者 | 人员身份和 UAT 入口策略 |

所有平台令牌、数据库密码、Access 服务令牌都只写入平台 secret、系统钥匙串或临时环境变量，不提交 Git。Cloudflare/Supabase 登录使用对应平台账号，不使用 Mac 开机密码。

## 一次性建设顺序

1. 运行 `wrangler login` 和 `supabase login` 完成浏览器授权。
2. 在 Supabase 新加坡区域创建 UAT 项目，执行 `supabase/roles.sql`、全部 migration 和幂等 seed。
3. 运行 `wrangler r2 bucket create wison-knowledge-files-uat` 与 `wrangler r2 bucket create wison-knowledge-quarantine-uat`。R2 默认保持私有，不配置 `r2.dev` 或自定义公开域名。
4. 使用 Supabase 的 IPv4 session pooler 连接串创建 Hyperdrive，并把返回的真实 ID 作为 `HYPERDRIVE` binding 写入 `apps/api/wrangler.jsonc` 的 `env.uat`。
5. 通过 Worker secrets/vars 配置 `CLOUDFLARE_ACCESS_TEAM_DOMAIN` 和 `CLOUDFLARE_ACCESS_AUD`；两者必须与 Access 应用一致。
6. 构建并部署 UAT Worker，再在 Cloudflare Zero Trust 为 UAT 子域名创建 Access self-hosted application 和允许列表。
7. 先完成未授权拒绝、Access 登录、API、R2 私有性检查，再进行人员和负载验收。

不得把 Supabase 连接串或 R2 密钥写进前端，也不得为了测试临时公开业务 API。

## 20–100 并发只读验收

真实人员用浏览器完成三项导航、公司筛选、完整/部分公司详情和报告元数据任务。基础设施负载使用 Access Service Token，并保持 Worker 端 JWT/策略验证开启：

```bash
export CF_ACCESS_CLIENT_ID='由 Cloudflare Secret 提供'
export CF_ACCESS_CLIENT_SECRET='由 Cloudflare Secret 提供'
npm run uat:load -- --base-url https://uat.example.com --concurrency 20 --requests 200
npm run uat:load -- --base-url https://uat.example.com --concurrency 50 --requests 500
npm run uat:load -- --base-url https://uat.example.com --concurrency 100 --requests 1000
```

门禁为：只发 GET；API p95 小于 500 ms；错误率小于 1%；未授权 API 和 R2 请求被拒绝；桌面 Chrome/Edge 和移动页面首个可交互目标小于 3 秒。负载工具最多记录前 10 个失败摘要，不输出 Access secret。

## 行业报告附件

附件不放 PostgreSQL，也不放 Web public assets。原始文件进入 private R2；PostgreSQL 只保存报告 ID、object key、SHA-256、MIME、文件大小、来源、权利状态、审核状态和关联公司。

首批附件采用 manifest 驱动的批量导入：程序计算 hash、校验扩展名/MIME、先写 quarantine、通过后复制到 published 并在一个数据库事务中更新元数据。用户不需要逐个手工上传。后续管理端再提供单文件上传和审核界面；在该链路完成前，现有报告页面继续诚实显示“附件未上传”。

## 后续子域名迁移

公司提供最终子域名后，重新绑定 Worker route、Access 策略和数据库/R2 环境即可，不需要重写前端。若最终以 iframe 内嵌简道云，发布前必须把 CSP `frame-ancestors` 收紧为简道云的准确父域名；UAT 期间继续禁止任意站点嵌入。

## 2026-08-04 执行记录

- Cloudflare 已创建 `wison-knowledge-files-uat` 和 `wison-knowledge-quarantine-uat`，两者均未开启 `r2.dev`，也未绑定公开自定义域名。
- Supabase 已创建新加坡区域 `wison-knowledge-platform-uat`，已正式应用 4 个 migration、角色文件和幂等 seed；远端核验为 126 家公司、8 家重点公司、234 条公司资产和 24 条关联信息。
- Cloudflare 已创建 `wison-knowledge-postgres-uat` Hyperdrive，UAT Worker 配置已绑定真实 ID，并关闭 SQL 响应缓存，避免权限上下文或数据更新被缓存混用。
- UAT 已部署到 `https://wison-knowledge-platform.wison.workers.dev`；Cloudflare Access 已启用，Worker 同时校验对应 AUD、issuer 和签名。旧的 `wison-knowledge-platform-uat` Worker 已删除，源代码仍可从 Git 恢复。
- GitHub 公司源重新生成后仍为 126 家公司、8 家完整看板和 24 条报告元数据，云端 seed 无差异。2026-08-04 油气价格刷新已同步至 private R2 的 `market-data/oil-gas-prices/2026-08-04.json` 与 `market-data/oil-gas-prices/latest.json`，远端 SHA-256 与仓库文件一致。
- 本地直连 PostgreSQL 的只读基线：20 并发、200 请求为 0% 错误且 p95 407.3 ms；50 并发 p95 976.4 ms、100 并发 p95 1866.7 ms，均超过 500 ms 门禁。应用没有返回错误，瓶颈表现为每请求直连本机数据库的连接开销。
- 50/100 并发结果不能替代云端验收，也不能视为通过。UAT 部署完成后必须通过 Hyperdrive 重跑 20/50/100 三档；若仍超标，再以云端追踪结果决定连接复用、查询或缓存优化。
- 当前本地网络对 `workers.dev` 存在 DNS 污染；可信 DNS 返回 Cloudflare 地址且 Access 302 已验证。公司正式子域名到位后应改用自定义域名，避免依赖 `workers.dev`。
- 真实邮箱登录、授权后页面任务和 20/50/100 云端负载仍待验收；负载测试需要 Access Service Token，不能用匿名请求绕过 Access。
