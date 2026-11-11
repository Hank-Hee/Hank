# Platform Foundation Architecture

## Runtime boundaries

- `apps/web` builds the React application-shell Static Assets; authenticated browser UX is deferred.
- `apps/api` is the only application boundary allowed to authorize governed data and file operations.
- The Web assets and Hono API are delivered as one Cloudflare Worker version. `/api/*` runs Worker-first; SPA navigation uses the Static Assets fallback.
- `packages/contracts` publishes shared request, response, user-context, and permission types.
- Supabase Auth issues user tokens.
- Supabase PostgreSQL is the only master data source.
- Cloudflare R2 is the only master binary attachment source.

## Authorization

Authorization is enforced by the API. PostgreSQL row-level security is defense in depth. A browser must not receive a database credential, Supabase service-role key, direct R2 credentials, or a permanent private-file URL.

The production target verifies an asymmetric Supabase JWT through the project JWKS endpoint, then uses a cache-disabled Hyperdrive direct connection and the least-privileged runtime role to load active-user grants. This Foundation wires those interfaces and proves asymmetric verification with local keys plus transaction/RLS behavior with local PostgreSQL; real project JWKS rotation and real Hyperdrive resource settings remain G3/G4 evidence. Every protected SQL query uses the same short transaction as `set_config('app.user_id', verifiedSub, true)` and fails closed when context is absent. The API checks explicit permissions before executing a protected route; roles never imply permissions, and `super_admin` is not an all-access bypass.

## Data and file boundaries

Existing Excel, JSON, HTML, and JavaScript datasets remain migration inputs or visual references. They are not production masters. Later domain plans must write approved records to PostgreSQL and store governed attachments in R2.

R2 buckets remain private. Quarantine uses a separate binding, object access stays behind `ObjectStorage`, and this Foundation exposes no report upload, preview, download, or public-file route.

## Public platform routes

`/api/v1/health` is the Foundation's only public API endpoint. `/api/v1/me` requires authentication and the explicit `platform.access` permission. The unauthenticated React shell has exactly three visible navigation entries—`首页`, `公司信息库`, and `行业报告库`—but contains no governed domain data; visible skeletal routes do not make a business API public. Unknown `/api/v1/*` paths return the shared JSON `NOT_FOUND` response and never fall through to the SPA.

## Extension rules

New domains must first close their PRD/design gate, then add shared schemas to `@wison/contracts`, mount routes under `/api/v1`, add database changes through ordered PostgreSQL migrations, enforce permissions in the API, and include unit, database, browser, and authorization tests appropriate to the change. This Foundation does not authorize company, project, report, search, ingestion, notification, vector, or AI features.
