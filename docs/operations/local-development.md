# Local Platform Development

## Prerequisites and execution modes

- Node.js 22.23.2
- npm 10.9.8
- Standard contributor/CI mode: a Docker-compatible runtime for the Supabase local stack
- Intel 8 GB Mac mode: Homebrew PostgreSQL 17 plus pgTAP, with full Supabase parity delegated to GitHub Actions on Ubuntu
- No production Cloudflare, Supabase, R2, domain, or deployment credential is required for Foundation verification

Do not install an untrusted legacy Docker Desktop build. On the current Intel Mac, native PostgreSQL is the fast local TDD loop because the complete Supabase stack recommends nearly all available memory. GitHub Actions is the authoritative container-parity gate.

## Install

```bash
node --version
npm --version
npm ci --engine-strict --no-audit --no-fund
npm ls --all
```

The versions must be `v22.23.2` and `10.9.8`.

## Database verification

The standard Supabase workflow, used by the database CI job, is:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase migration down --local --last 1 --yes
npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
npx supabase db query --local --file supabase/roles.sql
npx supabase migration up --local
npx supabase test db
npm run test:db -w @wison/api
```

CI gives `supabase start` three bounded attempts. A failed attempt is cleaned
with `supabase stop --no-backup`; the final attempt enables debug output.
This absorbs transient registry throttling or container-start interruption
without retrying migration, pgTAP, rollback, or application assertion failures.

On this Intel Mac, PostgreSQL 17 runs as the Homebrew service on port 5432. The local test database is `hank_platform_test`; apply `supabase/roles.sql` before the two files in `supabase/migrations`, run `supabase/tests/platform_foundation_test.sql` with `pg_prove`, and set this only for the integration command:

```bash
export TEST_DATABASE_URL='postgresql://shiyuhe@127.0.0.1:5432/hank_platform_test?sslmode=disable'
npm run test:db -w @wison/api
```

Native execution proves PostgreSQL 17 migration, pgTAP, transaction, driver, and RLS behavior. It does not replace the Ubuntu CI run of the exact Supabase CLI reset/rollback/replay sequence.

`supabase/roles.sql` owns the cluster-role lifecycle. The Foundation migration validates `app_runtime` and fails closed if the role is absent or unsafe; it never tries to repair protected role state while schema migrations are replayed.

## Configure API secrets

Create ignored `apps/api/.dev.vars` only when local Supabase output requires values not represented by checked-in development configuration:

```text
JWT_ALGORITHM=ES256
JWKS_CACHE_EPOCH=local-v1
SUPABASE_AUDIENCE=authenticated
SUPABASE_ISSUER=http://127.0.0.1:54321/auth/v1
```

Do not commit `.dev.vars`, database passwords, service-role keys, production tokens, or real Cloudflare binding IDs. The Foundation does not create a real local/production Hyperdrive binding or signing-key migration, so these values alone do not make `/api/v1/me` a live identity integration; that environment evidence remains a later G3/G4 gate.

## Start applications

Company Demo split hot-reload mode now starts the Worker API and React UI together:

```bash
brew services start postgresql@17
npm run dev
```

Open `http://127.0.0.1:4173`. The command uses the current macOS `$USER` as the native PostgreSQL role, connects to `hank_platform_test`, enables only the fixed local Demo session, and proxies both `/api/*` and `/company-assets/*` through the authenticated Worker. The database must already contain `supabase/roles.sql`, all migrations in filename order, and `supabase/seed.sql`; rerun the seed safely when the generated seed changes.

The production Worker does not use this direct connection string. It must receive a real `HYPERDRIVE` binding and must not enable `DEMO_AUTH_ENABLED`.

Integrated same-origin mode, used by smoke tests:

```bash
npm run build
npm run dev:api
```

Open `http://127.0.0.1:8787`.

Optional split hot-reload mode may use a second terminal:

```bash
npm run dev:web
```

The Vite development server proxies `/api/*` to the local Worker at `127.0.0.1:8787`. Split mode is development convenience only; production and E2E use the one-Worker same-origin artifact.

## Browser verification

The portable install and test commands are:

```bash
npm run e2e:install
npm run e2e
```

The current Mac may skip the first command and reuse `/Applications/Google Chrome.app` when the Playwright CDN is slow. Linux CI always installs the pinned Playwright Chromium package before running the same tests.

## Complete verification

```bash
npm ls --all
node --test tests/security-boundaries.test.mjs
npm run lint
npm run typecheck
npm test
npm run build
node --test tests/worker-artifact.integration.mjs
npm run test:db -w @wison/api
npm run e2e
```

The GitHub `database` job additionally runs every Supabase command shown in Database verification. A Foundation change is not container-parity complete until that job is green.

## Local ports

- Integrated Worker (Web + API): 8787
- Optional Vite hot reload: 4173
- Supabase API in container mode: 54321
- PostgreSQL in Supabase container mode: 54322
- Supabase Studio in container mode: 54323
- Native Homebrew PostgreSQL on this Mac: 5432

## Secret handling

Never place database passwords, Supabase service-role credentials, Cloudflare API tokens, R2 access keys, or production user tokens in source files, browser environment variables, test snapshots, or logs. Foundation build and smoke commands are local/dry-run evidence only and do not prove Cloudflare production acceptance.
