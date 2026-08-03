# Oil & Gas Knowledge Platform Foundation Implementation Plan

> **Execution workflow (approved 2026-08-03):** Use the lean engineering workflow: execute one Task at a time with test-first RED/GREEN evidence, all listed verification commands, the exact commit message, and a requirements/code-quality review before moving on. Do not dispatch routine per-Task implementation/review subagents. Use concentrated independent review at Foundation completion and at later database/authorization, identity, data-import, and pre-UAT risk gates. Steps use checkbox (`- [ ]`) syntax for tracking.

| Plan property | Value |
|---|---|
| Status | Approved canonical Foundation implementation plan; Tasks 1A–10 execute continuously after their own verification/review gates |
| Version | 2.1 |
| Date | 2026-08-03 |
| Product authority | `docs/product/PRD.md` v1.1 |
| System design | `docs/product/system-design.md` v1.1 |
| Technical architecture | `docs/architecture/technical-architecture.md` v1.1 |
| Roadmap | `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md` v1.1 |
| Acceptance | `docs/product/acceptance-criteria.md` v1.1 |
| Launch workspace | `docs/knowledge-platform-launch/` |
| Branch | `feat/platform-foundation` isolated worktree |
| Existing implementation | Task 1 at `aef248f` (`build: bootstrap platform workspaces`) |
| Next gate | Task 1A; after its gate passes, continue Tasks 2–10 without per-Task product approval |
| Approval basis | Hank approved continuous Foundation execution, automatic recovery for ordinary failures, the three-item UAT sidebar, and the company-first launch direction; 2026-08-03 |

**Goal:** Create the production-oriented application foundation for the internal oil and gas knowledge platform: workspace, React shell, Cloudflare Workers API, shared contracts, Supabase governance schema, authentication boundary, private R2 adapter, automated tests, and CI.

**Architecture:** Keep the TypeScript workspaces beside the current static prototypes without deleting or rewriting them. React Static Assets and the separately maintained Hono API package form one same-origin Cloudflare Worker version; the API is wired for asymmetric Supabase JWT verification and a Hyperdrive-compatible PostgreSQL connection, while private R2 stays behind an adapter. Local cryptographic and PostgreSQL tests prove the code boundary; real cache-disabled Hyperdrive/JWKS/R2 resources remain G3/G4 evidence. This plan creates only the platform foundation, not any company, project, report, search, ingestion, notification, vector, AI, or production-deployment feature.

**Tech Stack:** Node.js 22, npm workspaces, React, TypeScript, Vite, TanStack Router, TanStack Query, Hono, Cloudflare Workers, Supabase PostgreSQL/Auth, Cloudflare R2, Zod, JOSE, Vitest, Testing Library, Playwright, Supabase CLI, GitHub Actions.

## Global Constraints

- The first release is internal only.
- Primary users are sales and business development personnel.
- Market research maintains and governs content.
- PostgreSQL is the only master data source.
- Cloudflare R2 is the only master binary attachment source.
- GitHub JSON and Excel are migration/import artifacts, not production masters.
- Security levels are L1 public, L2 internal general, L3 licensed restricted, and L4 sensitive.
- Rights categories are `OWNED`, `PUBLIC_THIRD_PARTY`, `LICENSED_RESTRICTED`, and `DERIVED_REVIEW_REQUIRED`.
- Authorization is enforced by the API; PostgreSQL RLS is defense in depth.
- No report or attachment may be exposed through a permanent public URL.
- Search must be implemented before production AI question answering.
- Existing static pages remain untouched during this plan.
- Critical runtime assets must not depend on Google Fonts, `unpkg`, or inaccessible overseas map tiles.
- Local and CI Node.js must be exactly `22.23.2`; `engines.node` must be `>=22.22.2 <23`.
- npm must be `10.9.8`, recorded as `packageManager: npm@10.9.8`; installs use the committed lockfile and `npm ci --engine-strict`.
- TypeScript strict mode must be enabled.
- Every task must use test-driven development and end with a commit.
- Execute exactly one Task at a time. Confirm the specified expected RED, implement only that Task, run every listed verification command, commit with the exact message, then complete a focused requirements and code-quality review. Add concentrated independent review at Foundation completion and future database/authorization, login, import, and pre-UAT gates.
- A Task's explicitly expected RED is required evidence. Any other failed command keeps the current Task open while the root cause is diagnosed, minimally fixed, and the full Task verification is rerun; ordinary recoverable failures do not require product-owner approval.
- Do not commit or start a later Task until every required current-Task verification exits 0. Pause only for destructive real-data risk, security/rights/secret risk, missing external authority or credentials, an actual conflict in product authority, or an architectural escalation after the same root cause survives three fix attempts.
- Do not implement company, project, report, search, ingestion, notification, production deployment, vector, or AI features in this plan.
- The six role values do not imply permissions. `super_admin` must never receive all permissions through schema logic, code branches, or an all-permissions seed.
- Web and API are separate workspace boundaries but one production Worker artifact; the only publish sequence is contracts → Web assets → Worker bundle/deploy.

---

## 1. Scope and file structure

This plan creates the following structure:

```text
.
├── apps/
│   ├── api/
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── lib/
│   │   │   ├── middleware/
│   │   │   ├── routes/
│   │   │   ├── storage/
│   │   │   ├── app.ts
│   │   │   └── index.ts
│   │   ├── test/
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vitest.config.ts
│   │   └── wrangler.jsonc
│   └── web/
│       ├── src/
│       │   ├── components/
│       │   ├── lib/
│       │   ├── test/
│       │   ├── app-router.tsx
│       │   ├── main.tsx
│       │   └── styles.css
│       ├── index.html
│       ├── public/
│       │   └── _headers
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       └── vitest.config.ts
├── packages/
│   └── contracts/
│       ├── src/
│       ├── test/
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── supabase/
│   ├── migrations/
│   ├── rollback/
│   ├── rollback-tests/
│   ├── tests/
│   └── config.toml
├── e2e/
├── tests/
├── docs/architecture/
├── docs/operations/
├── package.json
├── package-lock.json
├── playwright.config.ts
├── tsconfig.base.json
└── .nvmrc
```

### Public interfaces locked by this plan

Later plans may consume these interfaces without changing their names:

```ts
// @wison/contracts
export type Permission =
  | 'platform.access'
  | 'admin.user.manage'
  | 'admin.authorization.manage'
  | 'admin.policy.manage'
  | 'audit.read';

export type Role =
  | 'sales_bd'
  | 'research_admin'
  | 'content_editor'
  | 'content_reviewer'
  | 'management_readonly'
  | 'super_admin';

export type SecurityLevel = 'L1' | 'L2' | 'L3' | 'L4';
export type RightsType =
  | 'OWNED'
  | 'PUBLIC_THIRD_PARTY'
  | 'LICENSED_RESTRICTED'
  | 'DERIVED_REVIEW_REQUIRED';

export type RequestId = string; // validated by ^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$
export type ApiErrorCode =
  | 'BAD_REQUEST'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'INTERNAL_ERROR';

export interface HealthResponse {
  status: 'ok';
  service: 'api';
  version: string;
  timestamp: string;
}

export interface UserContext {
  userId: string;
  email: string;
  roles: Role[];
  permissions: Permission[];
}

export interface ApiErrorResponse {
  error: { code: ApiErrorCode; message: string; requestId: RequestId };
}
```

Task 2 exports the corresponding runtime schemas `RequestIdSchema`, `ApiErrorCodeSchema`, `ApiErrorResponseSchema`, `HealthResponseSchema`, `RoleSchema`, `PermissionSchema`, `SecurityLevelSchema`, `RightsTypeSchema`, and `UserContextSchema`. Auth/database and storage interfaces are not prematurely locked here; Tasks 6 and 7 define and review them in their own boundaries.

---

### Task 1: Bootstrap the npm workspace

**Recorded status:** Complete at `aef248f` (`build: bootstrap platform workspaces`). The steps below preserve the reviewed historical scope and are not rerun. Task 1A corrects its toolchain declarations; Task 4 corrects its provisional single-Worker build sequencing.

**Files:**
- Create: `tests/workspace-layout.test.mjs`
- Create: `package.json`
- Create: `.nvmrc`
- Create: `tsconfig.base.json`
- Modify: `.gitignore`
- Create: `apps/web/package.json`
- Create: `apps/api/package.json`
- Create: `packages/contracts/package.json`

**Interfaces:**
- Consumes: Existing repository root; existing static files remain unchanged.
- Produces: npm workspaces named `@wison/web`, `@wison/api`, and `@wison/contracts`; root scripts used by every later task.

- [x] **Step 1: Write the failing workspace-layout test**

Create `tests/workspace-layout.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('root package declares the three platform workspaces and Node 22', async () => {
  const root = await readJson('../package.json');

  assert.deepEqual(root.workspaces, ['apps/*', 'packages/*']);
  assert.equal(root.engines.node, '>=22 <23');
  assert.equal(root.private, true);
});

test('workspace package names are stable', async () => {
  const [web, api, contracts] = await Promise.all([
    readJson('../apps/web/package.json'),
    readJson('../apps/api/package.json'),
    readJson('../packages/contracts/package.json'),
  ]);

  assert.equal(web.name, '@wison/web');
  assert.equal(api.name, '@wison/api');
  assert.equal(contracts.name, '@wison/contracts');
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test tests/workspace-layout.test.mjs
```

Expected: FAIL because `package.json` and workspace manifests do not exist.

- [x] **Step 3: Create the root workspace files**

Create `package.json`:

```json
{
  "name": "wison-oil-gas-knowledge-platform",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=22 <23"
  },
  "workspaces": [
    "apps/*",
    "packages/*"
  ],
  "scripts": {
    "build": "npm run build -w @wison/contracts && npm run build -w @wison/api && npm run build -w @wison/web",
    "dev:api": "npm run dev -w @wison/api",
    "dev:web": "npm run dev -w @wison/web",
    "e2e": "playwright test",
    "lint": "npm run lint -w @wison/contracts && npm run lint -w @wison/api && npm run lint -w @wison/web",
    "test": "node --test tests/*.test.mjs && npm run test -w @wison/contracts && npm run test -w @wison/api && npm run test -w @wison/web",
    "typecheck": "npm run typecheck -w @wison/contracts && npm run typecheck -w @wison/api && npm run typecheck -w @wison/web"
  }
}
```

Create `.nvmrc`:

```text
22
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "allowJs": false,
    "allowSyntheticDefaultImports": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "resolveJsonModule": true,
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  }
}
```

Append these lines to `.gitignore` without removing the existing Python and worktree entries:

```text
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
!.env.test
playwright-report/
test-results/
.wrangler/
.supabase/
```

- [x] **Step 4: Create the three workspace manifests**

Create `packages/contracts/package.json`:

```json
{
  "name": "@wison/contracts",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `apps/api/package.json`:

```json
{
  "name": "@wison/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "wrangler deploy --dry-run --outdir dist",
    "dev": "wrangler dev",
    "lint": "tsc --noEmit",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

Create `apps/web/package.json`:

```json
{
  "name": "@wison/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b && vite build",
    "dev": "vite",
    "lint": "tsc -b --pretty false",
    "test": "vitest run",
    "typecheck": "tsc -b --pretty false"
  }
}
```

- [x] **Step 5: Install the exact dependency groups and create the lockfile**

Run:

```bash
npm install -w @wison/contracts zod
npm install -D -w @wison/contracts typescript vitest
npm install -w @wison/api @wison/contracts hono jose zod @supabase/supabase-js
npm install -D -w @wison/api typescript vitest wrangler @cloudflare/workers-types
npm install -w @wison/web @wison/contracts react react-dom @tanstack/react-query @tanstack/react-router
npm install -D -w @wison/web typescript vite @vitejs/plugin-react vitest jsdom @testing-library/react @testing-library/jest-dom @types/react @types/react-dom
npm install -D @playwright/test supabase
```

Expected: `package-lock.json` is created and each dependency is recorded in the appropriate workspace manifest.

- [x] **Step 6: Run the workspace-layout test and verify it passes**

Run:

```bash
node --test tests/workspace-layout.test.mjs
```

Expected: PASS, 2 tests.

- [x] **Step 7: Commit**

```bash
git add package.json package-lock.json .nvmrc tsconfig.base.json .gitignore apps/web/package.json apps/api/package.json packages/contracts/package.json tests/workspace-layout.test.mjs
git commit -m "build: bootstrap platform workspaces"
```

---

### Task 1A: Pin the compatible Node and npm toolchain

**Files:**
- Modify: `tests/workspace-layout.test.mjs`
- Modify: `package.json`
- Modify: `.nvmrc`
- Modify: `package-lock.json` only through npm's lockfile update

**Interfaces:**
- Consumes: Task 1 commit `aef248f` and the locked dependencies requiring Node `>=22.22.2`.
- Produces: exact local/CI Node `22.23.2`, engine range `>=22.22.2 <23`, and `packageManager: npm@10.9.8` for every later Task.

- [ ] **Step 1: Add the failing toolchain assertions**

First replace the existing Task 1 assertion:

```js
assert.equal(root.engines.node, '>=22.22.2 <23');
```

Then append this test to `tests/workspace-layout.test.mjs`:

```js
test('toolchain versions match the locked dependency baseline', async () => {
  const [root, nvmrc] = await Promise.all([
    readJson('../package.json'),
    readFile(new URL('../.nvmrc', import.meta.url), 'utf8'),
  ]);

  assert.equal(root.engines.node, '>=22.22.2 <23');
  assert.equal(root.packageManager, 'npm@10.9.8');
  assert.equal(nvmrc.trim(), '22.23.2');
});
```

- [ ] **Step 2: Run the test and confirm the expected RED**

First activate Node `22.23.2` with the local version manager, then run:

```bash
test "$(node --version)" = "v22.23.2"
test "$(npm --version)" = "10.9.8"
node --test tests/workspace-layout.test.mjs
```

Expected: the version commands print `v22.23.2` and `10.9.8`; the test command exits nonzero because Task 1 currently declares `>=22 <23`, has no `packageManager`, and `.nvmrc` contains `22`. If another cause appears, diagnose and recover it before accepting the RED.

- [ ] **Step 3: Make only the toolchain declarations consistent**

Change the root fields to:

```json
{
  "packageManager": "npm@10.9.8",
  "engines": {
    "node": ">=22.22.2 <23"
  }
}
```

Replace `.nvmrc` with:

```text
22.23.2
```

Refresh lockfile metadata without changing dependency versions:

```bash
npm install --package-lock-only --ignore-scripts --engine-strict --no-audit --no-fund
```

- [ ] **Step 4: Run every Task 1A verification command**

```bash
test "$(node --version)" = "v22.23.2"
test "$(npm --version)" = "10.9.8"
node --test tests/workspace-layout.test.mjs
npm ci --engine-strict --no-audit --no-fund
npm ls --all
git diff -- package-lock.json
git diff --check
git status --short
```

Expected: Node/npm assertions pass; the workspace test reports 3 passing tests; install and dependency-tree commands exit 0; the status lists only `.nvmrc`, `package.json`, `package-lock.json`, and `tests/workspace-layout.test.mjs`. Inspect the displayed lockfile diff: only root `engines`/`packageManager` metadata may change; every dependency `version`, `resolved`, and `integrity` entry must remain byte-for-byte unchanged. Any dependency-entry change invalidates the result and must be root-caused and reverted before the Task can pass.

- [ ] **Step 5: Commit with the specified message**

```bash
git add .nvmrc package.json package-lock.json tests/workspace-layout.test.mjs
git commit -m "build: pin compatible Node toolchain"
```

- [ ] **Step 6: Complete the Task gate**

Run a focused requirements and code-quality review over `HEAD^..HEAD`, the single Task 1A commit. Separately retain the already completed consistency audit of Task 1 over `ac1a38f..aef248f` against the approved document chain. Resolve every Critical or Important finding and rerun all Step 4 commands before Task 2. Do not start Task 2 if either review gate is not clean.

---

### Task 2: Define shared API and authorization contracts

**Files:**
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/tsconfig.build.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/api.ts`
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/governance.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/api.test.ts`
- Create: `packages/contracts/test/auth.test.ts`
- Create: `packages/contracts/test/governance.test.ts`

**Interfaces:**
- Consumes: the reviewed Task 1A toolchain and Zod 4 from the contracts workspace.
- Produces: strict runtime schemas and inferred types for the exact API objects, six roles, five Foundation permissions, four security levels, and four rights types approved in Technical Architecture v1.1.
- Does not produce: role-to-permission mappings, API routes, authentication, database records, record grants, or any business-domain contract.

- [ ] **Step 1: Write the failing contract tests**

Create `packages/contracts/test/api.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
} from '../src/index';

describe('HealthResponseSchema', () => {
  it('accepts the canonical API health response', () => {
    const parsed = HealthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      timestamp: '2026-07-30T12:00:00.000Z',
    });

    expect(parsed.status).toBe('ok');
  });

  it('accepts a timestamp with an explicit positive offset', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        timestamp: '2026-07-30T20:00:00.000+08:00',
      }),
    ).not.toThrow();
  });

  it('rejects a timestamp without UTC Z or an explicit offset', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        timestamp: '2026-07-30T12:00:00',
      }),
    ).toThrow();
  });

  it('rejects an unknown field', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        timestamp: '2026-07-30T12:00:00.000Z',
        database: 'up',
      }),
    ).toThrow();
  });

  it('rejects an empty version', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok', service: 'api', version: '', timestamp: '2026-07-30T12:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('ApiErrorResponseSchema', () => {
  it.each(['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'])(
    'accepts published code %s',
    (code) => {
    const parsed = ApiErrorResponseSchema.parse({
      error: {
        code,
        message: 'Authentication is required.',
        requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
      },
    });

      expect(parsed.error.code).toBe(code);
    },
  );

  it.each(['req_a1234567', `req_${'a'.repeat(128)}`])(
    'accepts request-id boundary %s',
    (requestId) => {
      expect(() => ApiErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Not found.', requestId },
      })).not.toThrow();
    },
  );

  it.each(['VALIDATION_ERROR', 'SERVICE_UNAVAILABLE'])('rejects unpublished code %s', (code) => {
    expect(() =>
      ApiErrorResponseSchema.parse({
        error: {
          code,
          message: 'Rejected code.',
          requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
        },
      }),
    ).toThrow();
  });

  it.each(['req_short', 'request\nforged', '01J4P4Y7H4XZ8WWA73N42Q4Z5B'])(
    'rejects malformed request id %s',
    (requestId) => {
      expect(() =>
        ApiErrorResponseSchema.parse({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Unexpected error.',
            requestId,
          },
        }),
      ).toThrow();
    },
  );

  it('rejects unknown nested fields', () => {
    expect(() =>
      ApiErrorResponseSchema.parse({
        error: {
          code: 'NOT_FOUND',
          message: 'Not found.',
          requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
          stack: 'secret',
        },
      }),
    ).toThrow();
  });

  it.each(['', 'x'.repeat(501)])('rejects unsafe message length', (message) => {
    expect(() => ApiErrorResponseSchema.parse({
      error: { code: 'INTERNAL_ERROR', message, requestId: 'req_a1234567' },
    })).toThrow();
  });

  it('rejects an unknown outer field', () => {
    expect(() => ApiErrorResponseSchema.parse({
      error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'req_a1234567' },
      debug: true,
    })).toThrow();
  });
});
```

Create `packages/contracts/test/auth.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PermissionSchema,
  RoleSchema,
  UserContextSchema,
  permissionValues,
  roleValues,
} from '../src/index';

const baseContext = {
  userId: '7c786f9f-704f-4df0-b766-2199284ca34d',
  email: 'sales@example.com',
  roles: ['sales_bd'],
  permissions: ['platform.access'],
};

describe('published role and permission vocabulary', () => {
  it('contains exactly the approved values', () => {
    expect(roleValues).toEqual([
      'sales_bd',
      'research_admin',
      'content_editor',
      'content_reviewer',
      'management_readonly',
      'super_admin',
    ]);
    expect(permissionValues).toEqual([
      'platform.access',
      'admin.user.manage',
      'admin.authorization.manage',
      'admin.policy.manage',
      'audit.read',
    ]);
    expect(RoleSchema.parse('research_admin')).toBe('research_admin');
    expect(PermissionSchema.parse('audit.read')).toBe('audit.read');
  });
});

describe('UserContextSchema', () => {
  it('accepts a normal non-empty explicit context', () => {
    expect(UserContextSchema.parse(baseContext)).toEqual(baseContext);
  });

  it('accepts empty roles and permissions as default deny', () => {
    const parsed = UserContextSchema.parse({ ...baseContext, roles: [], permissions: [] });
    expect(parsed.roles).toEqual([]);
    expect(parsed.permissions).toEqual([]);
  });

  it('does not derive permissions from super_admin', () => {
    const parsed = UserContextSchema.parse({
      ...baseContext,
      roles: ['super_admin'],
      permissions: [],
    });
    expect(parsed.permissions).toEqual([]);
  });

  it.each([
    { ...baseContext, roles: ['unknown_role'] },
    { ...baseContext, permissions: ['database.drop'] },
    { ...baseContext, roles: ['sales_bd', 'sales_bd'] },
    { ...baseContext, permissions: ['platform.access', 'platform.access'] },
  ])('rejects unknown or duplicate authorization data', (value) => {
    expect(() => UserContextSchema.parse(value)).toThrow();
  });

  it('rejects an extra field independently', () => {
    expect(() => UserContextSchema.parse({ ...baseContext, extra: true })).toThrow();
  });

  it.each([
    { ...baseContext, userId: 'not-a-uuid' },
    { ...baseContext, email: 'not-an-email' },
    { ...baseContext, email: `${'x'.repeat(243)}@example.com` },
  ])('rejects malformed identity data', (value) => {
    expect(() => UserContextSchema.parse(value)).toThrow();
  });

  it('rejects a missing required field', () => {
    const { email: _email, ...missingEmail } = baseContext;
    expect(() => UserContextSchema.parse(missingEmail)).toThrow();
  });
});
```

Create `packages/contracts/test/governance.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  RightsTypeSchema,
  SecurityLevelSchema,
  rightsTypeValues,
  securityLevelValues,
} from '../src/index';

describe('governance vocabulary', () => {
  it('contains exactly the approved security levels and rights types', () => {
    expect(securityLevelValues).toEqual(['L1', 'L2', 'L3', 'L4']);
    expect(rightsTypeValues).toEqual([
      'OWNED',
      'PUBLIC_THIRD_PARTY',
      'LICENSED_RESTRICTED',
      'DERIVED_REVIEW_REQUIRED',
    ]);
  });

  it.each(['PUBLIC', 'L5'])('rejects unpublished security value %s', (value) => {
    expect(() => SecurityLevelSchema.parse(value)).toThrow();
  });

  it.each(['UNKNOWN', 'PUBLIC_DOMAIN'])('rejects unpublished rights value %s', (value) => {
    expect(() => RightsTypeSchema.parse(value)).toThrow();
  });
});
```

- [ ] **Step 2: Run the contract tests and verify they fail**

Run:

```bash
npm run test -w @wison/contracts
```

Expected: FAIL because `packages/contracts/src/index.ts` and the exported contract modules do not exist. This is the only accepted RED; environment, syntax, or unrelated dependency failures must be diagnosed and recovered before continuing the TDD cycle.

- [ ] **Step 3: Add TypeScript and Vitest configuration**

Create `packages/contracts/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

Create `packages/contracts/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": true,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

Create `packages/contracts/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: Implement the exact strict contracts**

Create `packages/contracts/src/api.ts`:

```ts
import { z } from 'zod';

export const RequestIdSchema = z
  .string()
  .regex(/^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/);

export type RequestId = z.infer<typeof RequestIdSchema>;

export const ApiErrorCodeSchema = z.enum([
  'BAD_REQUEST',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INTERNAL_ERROR',
]);

export type ApiErrorCode = z.infer<typeof ApiErrorCodeSchema>;

export const HealthResponseSchema = z.strictObject({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string().min(1),
  timestamp: z.iso.datetime({ offset: true }),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: ApiErrorCodeSchema,
    message: z.string().min(1).max(500),
    requestId: RequestIdSchema,
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
```

Create `packages/contracts/src/auth.ts`:

```ts
import { z } from 'zod';

export const permissionValues = [
  'platform.access',
  'admin.user.manage',
  'admin.authorization.manage',
  'admin.policy.manage',
  'audit.read',
] as const;

export const roleValues = [
  'sales_bd',
  'research_admin',
  'content_editor',
  'content_reviewer',
  'management_readonly',
  'super_admin',
] as const;

export const PermissionSchema = z.enum(permissionValues);
export type Permission = z.infer<typeof PermissionSchema>;

export const RoleSchema = z.enum(roleValues);
export type Role = z.infer<typeof RoleSchema>;

function uniqueValues(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export const UserContextSchema = z.strictObject({
  userId: z.uuid(),
  email: z.email().max(254),
  roles: z.array(RoleSchema).refine(uniqueValues, 'Roles must be unique.'),
  permissions: z
    .array(PermissionSchema)
    .refine(uniqueValues, 'Permissions must be unique.'),
});

export type UserContext = z.infer<typeof UserContextSchema>;
```

Create `packages/contracts/src/governance.ts`:

```ts
import { z } from 'zod';

export const securityLevelValues = ['L1', 'L2', 'L3', 'L4'] as const;
export const SecurityLevelSchema = z.enum(securityLevelValues);
export type SecurityLevel = z.infer<typeof SecurityLevelSchema>;

export const rightsTypeValues = [
  'OWNED',
  'PUBLIC_THIRD_PARTY',
  'LICENSED_RESTRICTED',
  'DERIVED_REVIEW_REQUIRED',
] as const;
export const RightsTypeSchema = z.enum(rightsTypeValues);
export type RightsType = z.infer<typeof RightsTypeSchema>;
```

Create `packages/contracts/src/index.ts`:

```ts
export * from './api';
export * from './auth';
export * from './governance';
```

- [ ] **Step 5: Run every Task 2 verification command**

Run:

```bash
npm run test -w @wison/contracts
npm run typecheck -w @wison/contracts
npm run lint -w @wison/contracts
npm run build -w @wison/contracts
test -f packages/contracts/dist/index.d.ts
node --test tests/workspace-layout.test.mjs
git diff --check
git status --short
```

Expected: every command exits 0. Evidence covers UTC and explicit-offset health timestamps, strict objects, non-empty version, all five accepted/error-code exclusions, message and request-ID boundaries, exact vocabularies, normal/default-deny/super-admin contexts, duplicate/unknown/malformed/missing identity data, and governance exclusions. The declaration file exists; the workspace test still reports 3 passing tests; status lists only the ten Task 2 paths.

- [ ] **Step 6: Commit with the specified message**

```bash
git add packages/contracts
git commit -m "feat: define shared foundation contracts"
```

- [ ] **Step 7: Complete the Task gate**

Run a requirements review against PRD v1.1, Technical Architecture v1.1 Section 15, and this Task, followed by a separate code-quality review. Resolve every Critical or Important finding and rerun all Step 5 commands. After the Task 2 gate is clean, record the result and continue to Task 3.

---

### Task 3: Create the Cloudflare Workers API shell

**Files:**
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Modify: `apps/api/package.json`
- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/lib/app-error.ts`
- Create: `apps/api/src/middleware/request-id.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: strict `HealthResponse`, `ApiErrorResponse`, `ApiErrorCode`, and `RequestIdSchema` from Task 2.
- Produces: public `GET /api/v1/health`; stable JSON 404/500 responses; validated request IDs; `createApp()` for later route composition.
- Defers: the sole Wrangler/Static Assets configuration and deploy dry-run to Task 4, after Web assets exist. Task 3 must not create an API-only deployment artifact or any Supabase/R2 binding.

- [ ] **Step 1: Write the failing health-route tests**

Create `apps/api/test/health.test.ts`:

```ts
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  RequestIdSchema,
} from '@wison/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/v1/health', () => {
  it('returns the typed health response and a request id', async () => {
    const response = await createApp().request('/api/v1/health');
    const body = HealthResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(() => RequestIdSchema.parse(response.headers.get('x-request-id'))).not.toThrow();
    expect(body).toMatchObject({ status: 'ok', service: 'api', version: '0.1.0' });
  });

  it('returns the stable error envelope for an unknown API route', async () => {
    const response = await createApp().request('/api/v1/not-a-route');
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
    expect(() => RequestIdSchema.parse(body.error.requestId)).not.toThrow();
  });

  it('preserves only a valid inbound request id', async () => {
    const accepted = await createApp().request('/api/v1/health', {
      headers: { 'x-request-id': 'req_client_12345678' },
    });
    const rejected = await createApp().request('/api/v1/health', {
      headers: { 'x-request-id': 'req_short' },
    });

    expect(accepted.headers.get('x-request-id')).toBe('req_client_12345678');
    expect(rejected.headers.get('x-request-id')).not.toBe('req_short');
    expect(() => RequestIdSchema.parse(rejected.headers.get('x-request-id'))).not.toThrow();
  });

  it('keeps the request id on unexpected errors', async () => {
    const app = createApp();
    app.get('/api/v1/fail-for-test', () => {
      throw new Error('internal detail');
    });

    const response = await app.request('/api/v1/fail-for-test', {
      headers: { 'x-request-id': 'req_failure_12345678' },
    });
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(response.headers.get('x-request-id')).toBe('req_failure_12345678');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
    expect(() => RequestIdSchema.parse(body.error.requestId)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run the API test and verify it fails**

Run:

```bash
npm run test -w @wison/api
```

Expected: FAIL because `src/app.ts` does not exist.

- [ ] **Step 3: Add API configuration and runtime types**

Create `apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "WebWorker"],
    "noEmit": true,
    "types": ["@cloudflare/workers-types", "vitest/globals"]
  },
  "include": ["src", "test", "vitest.config.ts"]
}
```

Create `apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

Change the API workspace build script in `apps/api/package.json` to remain local until Task 4 assembles the deployable artifact:

```json
"build": "tsc --noEmit"
```

Create `apps/api/src/types.ts`:

```ts
export interface AppBindings {
  APP_VERSION: string;
}

export interface AppVariables {
  requestId: string;
}

export type AppEnvironment = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
```

- [ ] **Step 4: Implement request IDs, errors, and health route**

Create `apps/api/src/lib/app-error.ts`:

```ts
import type { ApiErrorCode } from '@wison/contracts';

export class AppError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: 400 | 401 | 403 | 404 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

Create `apps/api/src/middleware/request-id.ts`:

```ts
import { RequestIdSchema } from '@wison/contracts';
import { createMiddleware } from 'hono/factory';
import type { AppEnvironment } from '../types';

export const requestIdMiddleware = createMiddleware<AppEnvironment>(async (context, next) => {
  const inbound = context.req.header('x-request-id');
  const parsed = RequestIdSchema.safeParse(inbound);
  const requestId = parsed.success ? parsed.data : `req_${crypto.randomUUID()}`;

  context.set('requestId', requestId);
  try {
    await next();
  } finally {
    context.header('x-request-id', requestId);
  }
});
```

Create `apps/api/src/routes/health.ts`:

```ts
import type { HealthResponse } from '@wison/contracts';
import { Hono } from 'hono';
import type { AppEnvironment } from '../types';

export const healthRoutes = new Hono<AppEnvironment>().get('/', (context) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'api',
    version: context.env?.APP_VERSION ?? '0.1.0',
    timestamp: new Date().toISOString(),
  };

  return context.json(body, 200);
});
```

Create `apps/api/src/app.ts`:

```ts
import type { ApiErrorResponse } from '@wison/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { AppError } from './lib/app-error';
import { requestIdMiddleware } from './middleware/request-id';
import { healthRoutes } from './routes/health';
import type { AppEnvironment } from './types';

export function createApp(): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());

  app.route('/api/v1/health', healthRoutes);

  app.notFound((context) => {
    const response: ApiErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route does not exist.',
        requestId: context.get('requestId'),
      },
    };
    return context.json(response, 404);
  });

  app.onError((error, context) => {
    const appError = error instanceof AppError
      ? error
      : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');

    const response: ApiErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        requestId: context.get('requestId'),
      },
    };
    context.header('x-request-id', context.get('requestId'));
    return context.json(response, appError.status);
  });

  return app;
}
```

Create `apps/api/src/index.ts`:

```ts
import { createApp } from './app';

export default createApp();
```

- [ ] **Step 5: Run API tests, type checking, and build**

Run:

```bash
npm run test -w @wison/api
npm run typecheck -w @wison/api
npm run lint -w @wison/api
npm run build -w @wison/api
node --test tests/workspace-layout.test.mjs
git diff --check
git status --short
```

Expected: all commands exit 0; four API tests pass; strict JSON health/404/500 envelopes carry valid request IDs and `nosniff`; Task 3 performs only local TypeScript verification and creates no Wrangler deployment artifact.

- [ ] **Step 6: Commit with the specified message**

```bash
git add apps/api
git commit -m "feat: add typed Workers API shell"
```

- [ ] **Step 7: Complete the Task gate**

Run requirements and code-quality reviews, resolve all Critical/Important findings, and rerun Step 5 before Task 4.

---

### Task 4: Create the React application shell

**Files:**
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/public/_headers`
- Create: `apps/web/index.html`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/components/health-badge.tsx`
- Create: `apps/web/src/app-router.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/test/app-shell.test.tsx`
- Create: `apps/api/wrangler.jsonc`
- Create: `tests/worker-artifact.test.mjs`
- Create: `tests/worker-artifact.integration.mjs`
- Modify: `apps/api/package.json`
- Modify: `package.json`

**Interfaces:**
- Consumes: public `GET /api/v1/health` and `HealthResponseSchema`.
- Produces: a left sidebar with exactly `/` (`首页`), `/companies` (`公司信息库`), and `/reports` (`行业报告库`); hidden `/admin` denial route; same-origin `getApiHealth()`; the sole Wrangler config combining Web assets and API into one dry-run Worker artifact.
- Does not produce: domain data, domain APIs, search behavior, notifications, admin operations, authentication, or production deployment.

- [ ] **Step 1: Write the failing application-shell test**

Create `apps/web/src/test/app-shell.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAppRouter } from '../app-router';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'api',
          version: '0.1.0',
          timestamp: '2026-07-30T12:00:00.000Z',
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ),
  );
});

describe('application shell', () => {
  it('renders the internal platform navigation and API health', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const router = createAppRouter(createMemoryHistory({ initialEntries: ['/'] }));

    render(
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: '市场知识平台' })).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', { name: '主导航' });
    expect(within(navigation).getAllByRole('link')).toHaveLength(3);
    expect(within(navigation).getByRole('link', { name: '首页' })).toHaveAttribute('href', '/');
    expect(within(navigation).getByRole('link', { name: '公司信息库' })).toHaveAttribute('href', '/companies');
    expect(within(navigation).getByRole('link', { name: '行业报告库' })).toHaveAttribute('href', '/reports');
    expect(screen.queryByRole('link', { name: '管理中心' })).not.toBeInTheDocument();
    expect(await screen.findByText('API 正常')).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/health',
      expect.objectContaining({ headers: { accept: 'application/json' } }),
    );
  });
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

Create `tests/worker-artifact.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function readJson(path) {
  return JSON.parse(await readFile(new URL(path, import.meta.url), 'utf8'));
}

test('one Worker build assembles contracts, Web assets, then API', async () => {
  const [root, api, wrangler, headers] = await Promise.all([
    readJson('../package.json'),
    readJson('../apps/api/package.json'),
    readJson('../apps/api/wrangler.jsonc'),
    readFile(new URL('../apps/web/public/_headers', import.meta.url), 'utf8'),
  ]);

  assert.equal(
    root.scripts.build,
    'npm run build -w @wison/contracts && npm run build -w @wison/web && npm run build -w @wison/api',
  );
  assert.equal(api.scripts.build, 'wrangler deploy --dry-run --outdir dist');
  assert.equal(wrangler.assets.directory, '../web/dist');
  assert.equal(wrangler.assets.not_found_handling, 'single-page-application');
  assert.deepEqual(wrangler.assets.run_worker_first, ['/api/*']);
  assert.equal(wrangler.vars.APP_VERSION, root.version);
  assert.match(headers, /Content-Security-Policy/);
  assert.match(headers, /X-Content-Type-Options: nosniff/);
  assert.match(headers, /Referrer-Policy: no-referrer/);
  assert.match(headers, /Permissions-Policy:/);

  await assert.rejects(
    readFile(new URL('../apps/web/wrangler.jsonc', import.meta.url), 'utf8'),
    { code: 'ENOENT' },
  );
});
```

Create `tests/worker-artifact.integration.mjs` (the filename intentionally stays outside the root `tests/*.test.mjs` unit-test glob because it starts the JavaScript emitted by the Wrangler dry-run):

```js
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';

const origin = 'http://127.0.0.1:8791';
const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

async function waitForWorker(server, output) {
  let lastError;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (attempt > 0 && server.pid === undefined) {
      throw new Error(`Wrangler could not start.\n${output()}`);
    }
    if (server.exitCode !== null) {
      throw new Error(`Wrangler exited before readiness.\n${output()}`);
    }
    try {
      const response = await fetch(`${origin}/api/v1/health`);
      if (response.ok) return;
      lastError = new Error(`Health readiness returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(500);
  }
  throw new Error(`Wrangler did not become ready: ${String(lastError)}\n${output()}`);
}

test('built Worker serves the SPA and strict API from one origin', { timeout: 45_000 }, async (t) => {
  let output = '';
  let spawnError;
  const server = spawn(
    'npm',
    [
      'exec', '--workspace', '@wison/api', 'wrangler', '--',
      'dev', 'dist/index.js', '--no-bundle', '--local', '--port', '8791',
    ],
    {
      cwd: repositoryRoot,
      env: { ...process.env, NO_COLOR: '1' },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  server.stdout.setEncoding('utf8');
  server.stderr.setEncoding('utf8');
  server.stdout.on('data', (chunk) => { output += chunk; });
  server.stderr.on('data', (chunk) => { output += chunk; });
  server.on('error', (error) => { spawnError = error; });

  t.after(async () => {
    if (server.exitCode === null) {
      const exited = once(server, 'exit');
      server.kill('SIGTERM');
      await Promise.race([exited, delay(5_000)]);
      if (server.exitCode === null) server.kill('SIGKILL');
    }
  });

  await waitForWorker(server, () => `${String(spawnError ?? '')}\n${output}`);

  const [rootPackage, home, deepLink, health, missing] = await Promise.all([
    readFile(new URL('../package.json', import.meta.url), 'utf8').then(JSON.parse),
    fetch(`${origin}/`),
    fetch(`${origin}/reports`),
    fetch(`${origin}/api/v1/health`),
    fetch(`${origin}/api/v1/not-a-route`),
  ]);

  assert.equal(home.status, 200);
  assert.match(home.headers.get('content-type') ?? '', /text\/html/);
  for (const response of [home, deepLink]) {
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-security-policy') ?? '', /default-src 'self'/);
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.match(response.headers.get('permissions-policy') ?? '', /camera=\(\)/);
  }
  assert.match(await deepLink.text(), /<div id="root"><\/div>/);

  assert.equal(health.status, 200);
  assert.match(health.headers.get('content-type') ?? '', /application\/json/);
  const healthBody = await health.json();
  assert.deepEqual(Object.keys(healthBody).sort(), ['service', 'status', 'timestamp', 'version']);
  assert.equal(healthBody.status, 'ok');
  assert.equal(healthBody.service, 'api');
  assert.equal(healthBody.version, rootPackage.version);
  assert.match(healthBody.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);

  assert.equal(missing.status, 404);
  assert.match(missing.headers.get('content-type') ?? '', /application\/json/);
  const missingBody = await missing.json();
  assert.deepEqual(Object.keys(missingBody), ['error']);
  assert.equal(missingBody.error.code, 'NOT_FOUND');
  assert.match(missingBody.error.requestId, /^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$/);
});
```

- [ ] **Step 2: Run the web test and verify it fails**

Run:

```bash
npm run test -w @wison/web
node --test tests/worker-artifact.test.mjs
node --test tests/worker-artifact.integration.mjs
```

Expected: all three commands FAIL for the scoped missing Web/router/Worker artifacts. The integration test must fail because the Worker artifact cannot start; diagnose and recover any unrelated failure before accepting the RED.

- [ ] **Step 3: Add web configuration**

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "noEmit": true,
    "types": ["vite/client", "vitest/globals"]
  },
  "include": ["src", "vite.config.ts", "vitest.config.ts"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `apps/web/tsconfig.node.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "noEmit": true,
    "types": ["node"]
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

Install the Node types required by the config:

```bash
npm install -D -w @wison/web @types/node
```

Create `apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 4173,
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
```

Create `apps/web/vitest.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

Create `apps/web/public/_headers`:

```text
/*
  Content-Security-Policy: default-src 'self'; base-uri 'self'; frame-ancestors 'none'; object-src 'none'; connect-src 'self'; img-src 'self' data:; font-src 'self'; style-src 'self'
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), geolocation=(), microphone=()
```

Create the repository's only Wrangler entry config at `apps/api/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wison-knowledge-platform",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-31",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "APP_VERSION": "0.1.0"
  },
  "assets": {
    "directory": "../web/dist",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*"]
  }
}
```

Change the root `package.json` build order to:

```json
"build": "npm run build -w @wison/contracts && npm run build -w @wison/web && npm run build -w @wison/api"
```

Change the API `package.json` build script to:

```json
"build": "wrangler deploy --dry-run --outdir dist"
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex,nofollow" />
    <title>市场知识平台</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Implement the typed health client and badge**

Create `apps/web/src/lib/api-client.ts`:

```ts
import { HealthResponseSchema, type HealthResponse } from '@wison/contracts';

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/api/v1/health', {
    headers: { accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`Health request failed with status ${response.status}`);
  }

  return HealthResponseSchema.parse(await response.json());
}
```

Create `apps/web/src/components/health-badge.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { getApiHealth } from '../lib/api-client';

export function HealthBadge() {
  const query = useQuery({
    queryKey: ['api-health'],
    queryFn: ({ signal }) => getApiHealth(signal),
    staleTime: 60_000,
  });

  if (query.isPending) return <span className="health health--loading">API 检查中</span>;
  if (query.isError) return <span className="health health--error">API 异常</span>;
  return <span className="health health--ok">API 正常</span>;
}
```

- [ ] **Step 5: Implement the router and application shell**

Create `apps/web/src/app-router.tsx`:

```tsx
import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
  type RouterHistory,
} from '@tanstack/react-router';
import { HealthBadge } from './components/health-badge';

const navigation = [
  ['/', '首页'],
  ['/companies', '公司信息库'],
  ['/reports', '行业报告库'],
] as const;

function AppShell() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Wison Internal</p>
          <h1>市场知识平台</h1>
        </div>
        <HealthBadge />
      </header>
      <div className="app-body">
        <nav aria-label="主导航" className="primary-nav">
          {navigation.map(([to, label]) => (
            <Link key={to} to={to} activeProps={{ 'aria-current': 'page' }}>
              {label}
            </Link>
          ))}
        </nav>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

function HomePage() {
  return (
    <section>
      <h2>内部油气行业知识入口</h2>
      <p>公司信息库和行业报告库将在后续独立计划中接入正式数据。</p>
    </section>
  );
}

function SectionPage({ title }: { title: string }) {
  return (
    <section>
      <h2>{title}</h2>
      <p>基础路由已建立，领域功能不在本阶段实现。</p>
    </section>
  );
}

function AdminDeniedPage() {
  return (
    <section>
      <h2>无权访问</h2>
      <p>管理中心入口只会在后续身份 Task 确认显式管理权限后显示。</p>
    </section>
  );
}

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const companiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies', component: () => <SectionPage title="公司信息库" /> });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: () => <SectionPage title="行业报告库" /> });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: AdminDeniedPage });

const routeTree = rootRoute.addChildren([
  indexRoute,
  companiesRoute,
  reportsRoute,
  adminRoute,
]);

export function createAppRouter(history?: RouterHistory) {
  return createRouter({ routeTree, history });
}

export const router = createAppRouter();

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
```

Create `apps/web/src/main.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { router } from './app-router';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found.');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
```

Create `apps/web/src/styles.css`:

```css
:root {
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif;
  color: #172033;
  background: #f4f6f9;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
a { color: inherit; }

.app-shell { min-height: 100vh; }
.app-body { display: grid; grid-template-columns: 220px minmax(0, 1fr); min-height: calc(100vh - 93px); }
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  padding: 24px 32px;
  background: #ffffff;
  border-bottom: 1px solid #dfe4ec;
}
.topbar h1 { margin: 2px 0 0; font-size: 24px; }
.eyebrow { margin: 0; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #637083; }
.primary-nav { display: flex; flex-direction: column; gap: 8px; padding: 24px 16px; background: #ffffff; border-right: 1px solid #dfe4ec; }
.primary-nav a { padding: 8px 12px; border-radius: 8px; text-decoration: none; white-space: nowrap; }
.primary-nav a[aria-current="page"] { background: #e8edf5; font-weight: 600; }
.page-content { padding: 32px; }
.health { padding: 6px 10px; border-radius: 999px; font-size: 13px; }
.health--ok { background: #e5f5ea; color: #176b36; }
.health--loading { background: #eef1f5; color: #4e5b6d; }
.health--error { background: #fdeaea; color: #9d2020; }

@media (max-width: 720px) {
  .app-body { grid-template-columns: 1fr; }
  .primary-nav { flex-direction: row; overflow-x: auto; border-right: 0; border-bottom: 1px solid #dfe4ec; }
}
```

- [ ] **Step 6: Run web tests, type checking, and build**

Run:

```bash
npm run test -w @wison/web
npm run typecheck -w @wison/web
npm run lint -w @wison/web
npm run build -w @wison/web
node --test tests/worker-artifact.test.mjs
npm run build
test -f apps/web/dist/index.html
test -f apps/api/dist/index.js
node --test tests/worker-artifact.integration.mjs
git diff --check
git status --short
```

Expected: all commands exit 0; application-shell, structural artifact, and live artifact integration tests pass; `apps/web/dist/index.html` exists before the single Wrangler dry-run succeeds, and the integration test runs its emitted `apps/api/dist/index.js` with bundling disabled; that artifact serves SPA deep links plus strict JSON API behavior with security headers from one origin; no `apps/web/wrangler.jsonc` exists.

- [ ] **Step 7: Commit with the specified message**

```bash
git add apps/web apps/api/package.json apps/api/wrangler.jsonc tests/worker-artifact.test.mjs tests/worker-artifact.integration.mjs package.json package-lock.json
git commit -m "feat: add React platform shell"
```

- [ ] **Step 8: Complete the Task gate**

Run requirements and code-quality reviews, resolve all Critical/Important findings, and rerun Step 6 before Task 5.

---

### Task 5: Create the private Foundation governance schema and fail-closed RLS context

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/tests/platform_foundation_test.sql`
- Create: `supabase/rollback/202607310001_platform_foundation_down.sql`
- Create: `supabase/rollback-tests/platform_foundation_absent_test.sql`
- Create: `supabase/migrations/202607310000_foundation_anchor.sql`
- Create: `supabase/migrations/202607310001_platform_foundation.sql`

**Interfaces:**
- Consumes: Task 2's exact roles, permissions, security levels, rights types, and `UserContext` shape.
- Produces: private schema `app_private`; least-privileged `app_runtime` group role; Foundation governance tables; `app_private.current_user_id()` and `app_private.get_current_user_context()`.
- Defers: domain tables/permissions, teams, subscriptions, L3/L4 record grants, production login roles/credentials, production migration, and production Hyperdrive creation.

- [ ] **Step 1: Write the failing pgTAP specification first**

Create `supabase/rollback-tests/platform_foundation_absent_test.sql`; it is outside the default `supabase/tests` directory so normal post-migration verification cannot accidentally execute the pre-Foundation assertion:

```sql
begin;
select plan(2);
select hasnt_schema('app_private', 'Foundation schema is absent after baseline rollback');
select hasnt_role('app_runtime', 'Foundation runtime role is absent after baseline rollback');
select * from finish();
rollback;
```

Create `supabase/tests/platform_foundation_test.sql`:

```sql
begin;
select plan(33);

select has_table('app_private', 'profiles');
select has_table('app_private', 'roles');
select has_table('app_private', 'permissions');
select has_table('app_private', 'role_permissions');
select has_table('app_private', 'user_roles');
select has_table('app_private', 'security_levels');
select has_table('app_private', 'rights_types');
select has_table('app_private', 'audit_events');
select has_function('app_private', 'current_user_id', array[]::text[]);
select has_function('app_private', 'get_current_user_context', array[]::text[]);

select is((select count(*) from app_private.roles), 6::bigint, 'six roles');
select is((select count(*) from app_private.permissions), 5::bigint, 'five permissions');
select is((select count(*) from app_private.security_levels), 4::bigint, 'four levels');
select is((select count(*) from app_private.rights_types), 4::bigint, 'four rights types');

select results_eq(
  $$select code from app_private.roles order by code$$,
  $$values ('content_editor'), ('content_reviewer'), ('management_readonly'), ('research_admin'), ('sales_bd'), ('super_admin')$$,
  'exact role vocabulary'
);
select results_eq(
  $$select code from app_private.permissions order by code$$,
  $$values ('admin.authorization.manage'), ('admin.policy.manage'), ('admin.user.manage'), ('audit.read'), ('platform.access')$$,
  'exact Foundation permission vocabulary'
);
select results_eq(
  $$select code from app_private.security_levels order by rank$$,
  $$values ('L1'), ('L2'), ('L3'), ('L4')$$,
  'exact security levels'
);
select results_eq(
  $$select code from app_private.rights_types order by code$$,
  $$values ('DERIVED_REVIEW_REQUIRED'), ('LICENSED_RESTRICTED'), ('OWNED'), ('PUBLIC_THIRD_PARTY')$$,
  'exact rights types'
);
select results_eq(
  $$select role_code || ':' || permission_code from app_private.role_permissions order by role_code, permission_code$$,
  $$values
    ('content_editor:platform.access'),
    ('content_reviewer:audit.read'),
    ('content_reviewer:platform.access'),
    ('management_readonly:audit.read'),
    ('management_readonly:platform.access'),
    ('research_admin:audit.read'),
    ('research_admin:platform.access'),
    ('sales_bd:platform.access'),
    ('super_admin:admin.authorization.manage'),
    ('super_admin:admin.policy.manage'),
    ('super_admin:admin.user.manage'),
    ('super_admin:audit.read'),
    ('super_admin:platform.access')$$,
  'explicit role mapping without wildcard or cross join'
);

select ok(
  (select
    not runtime.rolcanlogin
    and not runtime.rolsuper
    and not runtime.rolcreatedb
    and not runtime.rolcreaterole
    and not runtime.rolinherit
    and not runtime.rolreplication
    and not runtime.rolbypassrls
    and not exists (select 1 from pg_auth_members membership where membership.member = runtime.oid)
    and not exists (
      select 1
      from pg_class relation
      join pg_namespace namespace on namespace.oid = relation.relnamespace
      where namespace.nspname = 'app_private'
        and relation.relkind = 'r'
        and relation.relowner = runtime.oid
    )
    from pg_roles runtime
    where runtime.rolname = 'app_runtime'),
  'runtime is nologin, noinherit, non-owner, non-member, and has no elevated attributes'
);
select ok(
  has_schema_privilege('app_runtime', 'app_private', 'USAGE')
  and not has_schema_privilege('app_runtime', 'app_private', 'CREATE')
  and (
    select array_agg(table_name::text order by table_name)
    from information_schema.role_table_grants
    where grantee = 'app_runtime'
      and table_schema = 'app_private'
      and privilege_type = 'SELECT'
  ) = array[
    'permissions', 'profiles', 'rights_types', 'role_permissions',
    'roles', 'security_levels', 'user_roles'
  ]::text[]
  and not exists (
    select 1 from information_schema.role_table_grants
    where grantee = 'app_runtime'
      and table_schema = 'app_private'
      and privilege_type <> 'SELECT'
  )
  and has_function_privilege('app_runtime', 'app_private.current_user_id()', 'EXECUTE')
  and has_function_privilege('app_runtime', 'app_private.get_current_user_context()', 'EXECUTE')
  and not exists (
    select 1 from information_schema.table_privileges
    where grantee in ('PUBLIC', 'anon', 'authenticated') and table_schema = 'app_private'
  )
  and not exists (
    select 1 from information_schema.routine_privileges
    where grantee in ('PUBLIC', 'anon', 'authenticated') and routine_schema = 'app_private'
  ),
  'runtime has only the exact Foundation read/execute grants and browser roles have none'
);
select ok(
  not exists (
    select 1
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'app_private'
      and relation.relname = any (array[
        'profiles', 'roles', 'permissions', 'role_permissions',
        'user_roles', 'security_levels', 'rights_types', 'audit_events'
      ])
      and not (relation.relrowsecurity and relation.relforcerowsecurity)
  ),
  'all eight private tables enable and force RLS'
);

select is(app_private.current_user_id(), null::uuid, 'missing context fails closed');
set local app.user_id = '';
select is(app_private.current_user_id(), null::uuid, 'empty context fails closed');
set local app.user_id = 'not-a-uuid';
select is(app_private.current_user_id(), null::uuid, 'malformed context fails closed');
set local app.user_id = '019535d9-3df7-7a61-b20a-84d2a4e79057';
select is(
  app_private.current_user_id(),
  '019535d9-3df7-7a61-b20a-84d2a4e79057'::uuid,
  'UUIDv7 context matches the Task 2 UUID contract'
);

insert into app_private.profiles (user_id, email, status) values
  ('00000000-0000-4000-8000-000000000001', 'a@example.com', 'active'),
  ('00000000-0000-4000-8000-000000000002', 'b@example.com', 'active'),
  ('00000000-0000-4000-8000-000000000003', 'disabled@example.com', 'inactive'),
  ('00000000-0000-4000-8000-000000000004', 'admin@example.com', 'active');
insert into app_private.user_roles (user_id, role_code) values
  ('00000000-0000-4000-8000-000000000001', 'sales_bd'),
  ('00000000-0000-4000-8000-000000000003', 'sales_bd'),
  ('00000000-0000-4000-8000-000000000004', 'super_admin');

set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000001';
select is((select count(*) from app_private.profiles), 1::bigint, 'user A cannot read user B');
select is(
  app_private.get_current_user_context(),
  '{"email":"a@example.com","permissions":["platform.access"],"roles":["sales_bd"],"userId":"00000000-0000-4000-8000-000000000001"}'::jsonb,
  'context is stable, unique, and matches Task 2 shape'
);
set local app.user_id = '00000000-0000-4000-8000-000000000003';
select is(app_private.get_current_user_context(), null::jsonb, 'inactive profile returns no context');
select is((select count(*) from app_private.roles), 0::bigint, 'inactive user cannot read lookup rows');
set local app.user_id = '00000000-0000-4000-8000-000000000099';
select is((select count(*) from app_private.roles), 0::bigint, 'unknown user cannot read lookup rows');
reset role;

insert into app_private.permissions (code, description) values ('future.domain.read', 'synthetic future permission');
set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000004';
select ok(
  not (app_private.get_current_user_context()->'permissions' ? 'future.domain.read'),
  'future permission is not inferred for super_admin'
);
reset role;

delete from app_private.role_permissions where role_code = 'super_admin';
set local role app_runtime;
set local app.user_id = '00000000-0000-4000-8000-000000000004';
select is(
  app_private.get_current_user_context()->'permissions',
  '[]'::jsonb,
  'super_admin with no grants has no inferred permissions'
);
reset role;

select * from finish();
rollback;
```

- [ ] **Step 2: Add only the local test harness, then confirm RED**

Run `npx supabase init`, retain the generated config, and set these exact local values in `supabase/config.toml`:

```toml
project_id = "wison-oil-gas-knowledge-platform"

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 17

[studio]
enabled = true
port = 54323
```

The private `app_private` schema is intentionally absent from the Data API schema list. Then run:

```bash
npx supabase start
npx supabase test db
```

Expected: FAIL because `app_private` objects do not exist. Docker/CLI/environment failures are not accepted as RED and must be diagnosed and recovered first.

- [ ] **Step 3: Implement the private migration**

Create `supabase/migrations/202607310000_foundation_anchor.sql` as the no-object predecessor required to rehearse a one-version rollback of the still-unreleased Foundation baseline:

```sql
-- Deliberately empty: establishes the pre-Foundation local migration boundary.
```

This anchor creates no schema, table, role, function, data, extension, or production state. It exists only because the Supabase CLI requires `--last` to be smaller than the number of applied migrations; with the anchor plus the baseline, `migration down --last 1` reconstructs the schema state at the pre-Foundation boundary, and the version-matched cleanup below completes that boundary by removing the baseline's cluster role.

Create `supabase/migrations/202607310001_platform_foundation.sql`:

```sql
create extension if not exists pgcrypto with schema extensions;
create schema if not exists app_private;
revoke all on schema app_private from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime;
  end if;
end
$$;

alter role app_runtime
  nologin nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls;

do $$
declare
  granted_role text;
begin
  for granted_role in
    select parent.rolname
    from pg_auth_members membership
    join pg_roles member on member.oid = membership.member
    join pg_roles parent on parent.oid = membership.roleid
    where member.rolname = 'app_runtime'
  loop
    execute format('revoke %I from app_runtime', granted_role);
  end loop;
end
$$;

create table app_private.security_levels (
  code text primary key,
  rank smallint not null unique check (rank between 1 and 4)
);
create table app_private.rights_types (code text primary key);
create table app_private.roles (code text primary key, name_zh text not null);
create table app_private.permissions (code text primary key, description text not null);
create table app_private.role_permissions (
  role_code text not null references app_private.roles(code) on delete cascade,
  permission_code text not null references app_private.permissions(code) on delete cascade,
  primary key (role_code, permission_code)
);
create table app_private.profiles (
  user_id uuid primary key,
  email text not null check (char_length(email) between 3 and 254 and position('@' in email) > 1),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table app_private.user_roles (
  user_id uuid not null references app_private.profiles(user_id) on delete cascade,
  role_code text not null references app_private.roles(code) on delete cascade,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_code)
);
create table app_private.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid,
  request_id text not null check (request_id ~ '^req_[A-Za-z0-9][A-Za-z0-9_-]{7,127}$'),
  action text not null,
  subject_type text not null,
  subject_id text,
  metadata jsonb not null default '{}'::jsonb
);

insert into app_private.security_levels (code, rank) values
  ('L1', 1), ('L2', 2), ('L3', 3), ('L4', 4);
insert into app_private.rights_types (code) values
  ('OWNED'), ('PUBLIC_THIRD_PARTY'), ('LICENSED_RESTRICTED'), ('DERIVED_REVIEW_REQUIRED');
insert into app_private.roles (code, name_zh) values
  ('sales_bd', '销售/商务'),
  ('research_admin', '市场研究管理员'),
  ('content_editor', '内容编辑'),
  ('content_reviewer', '内容审核员'),
  ('management_readonly', '管理层只读'),
  ('super_admin', '超级管理员');
insert into app_private.permissions (code, description) values
  ('platform.access', 'Enter the authenticated platform.'),
  ('admin.user.manage', 'Manage user accounts.'),
  ('admin.authorization.manage', 'Manage roles and explicit grants.'),
  ('admin.policy.manage', 'Manage approved platform policy.'),
  ('audit.read', 'Read Foundation audit records through a later controlled interface.');
insert into app_private.role_permissions (role_code, permission_code) values
  ('sales_bd', 'platform.access'),
  ('research_admin', 'platform.access'),
  ('research_admin', 'audit.read'),
  ('content_editor', 'platform.access'),
  ('content_reviewer', 'platform.access'),
  ('content_reviewer', 'audit.read'),
  ('management_readonly', 'platform.access'),
  ('management_readonly', 'audit.read'),
  ('super_admin', 'platform.access'),
  ('super_admin', 'admin.user.manage'),
  ('super_admin', 'admin.authorization.manage'),
  ('super_admin', 'admin.policy.manage'),
  ('super_admin', 'audit.read');

create or replace function app_private.current_user_id()
returns uuid
language plpgsql
stable
security invoker
set search_path = pg_catalog
as $$
declare
  raw_user_id text := current_setting('app.user_id', true);
begin
  if raw_user_id is null
     or raw_user_id = ''
     or raw_user_id !~ '^([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}|00000000-0000-0000-0000-000000000000|ffffffff-ffff-ffff-ffff-ffffffffffff)$' then
    return null;
  end if;
  return raw_user_id::uuid;
end
$$;

create or replace function app_private.get_current_user_context()
returns jsonb
language sql
stable
security invoker
set search_path = pg_catalog, app_private
as $$
  select jsonb_build_object(
    'userId', p.user_id::text,
    'email', p.email,
    'roles', coalesce((
      select jsonb_agg(role_code order by role_code)
      from (select distinct ur.role_code from app_private.user_roles ur where ur.user_id = p.user_id) r
    ), '[]'::jsonb),
    'permissions', coalesce((
      select jsonb_agg(permission_code order by permission_code)
      from (
        select distinct rp.permission_code
        from app_private.user_roles ur
        join app_private.role_permissions rp on rp.role_code = ur.role_code
        where ur.user_id = p.user_id
      ) permissions_for_user
    ), '[]'::jsonb)
  )
  from app_private.profiles p
  where p.user_id = app_private.current_user_id()
    and p.status = 'active';
$$;

alter table app_private.profiles enable row level security;
alter table app_private.profiles force row level security;
alter table app_private.user_roles enable row level security;
alter table app_private.user_roles force row level security;
alter table app_private.roles enable row level security;
alter table app_private.roles force row level security;
alter table app_private.permissions enable row level security;
alter table app_private.permissions force row level security;
alter table app_private.role_permissions enable row level security;
alter table app_private.role_permissions force row level security;
alter table app_private.security_levels enable row level security;
alter table app_private.security_levels force row level security;
alter table app_private.rights_types enable row level security;
alter table app_private.rights_types force row level security;
alter table app_private.audit_events enable row level security;
alter table app_private.audit_events force row level security;

create policy profiles_self on app_private.profiles for select to app_runtime
  using (user_id = app_private.current_user_id() and status = 'active');
create policy user_roles_self on app_private.user_roles for select to app_runtime
  using (
    user_id = app_private.current_user_id()
    and exists (
      select 1 from app_private.profiles active_profile
      where active_profile.user_id = app_private.current_user_id()
        and active_profile.status = 'active'
    )
  );
create policy roles_authenticated_context on app_private.roles for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy permissions_authenticated_context on app_private.permissions for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy role_permissions_authenticated_context on app_private.role_permissions for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy security_levels_authenticated_context on app_private.security_levels for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));
create policy rights_types_authenticated_context on app_private.rights_types for select to app_runtime
  using (exists (
    select 1 from app_private.profiles active_profile
    where active_profile.user_id = app_private.current_user_id()
      and active_profile.status = 'active'
  ));

revoke all on all tables in schema app_private from public, anon, authenticated;
revoke all on all functions in schema app_private from public, anon, authenticated;
grant usage on schema app_private to app_runtime;
grant select on app_private.profiles, app_private.user_roles, app_private.roles,
  app_private.permissions, app_private.role_permissions,
  app_private.security_levels, app_private.rights_types to app_runtime;
grant execute on function app_private.current_user_id() to app_runtime;
grant execute on function app_private.get_current_user_context() to app_runtime;
```

The migration deliberately creates no policy and grants no runtime access for `audit_events`; a later controlled audit interface must add the minimum required policy.

Create `supabase/rollback/202607310001_platform_foundation_down.sql` as the version-matched cleanup for the one cluster-level object that Supabase schema replay does not remove:

```sql
-- Local rehearsal only: fail if app_runtime still owns or can access any surviving object.
drop role if exists app_runtime;
```

The rollback pgTAP runs before `migration up`, so its explicit absence assertions prevent idempotent baseline DDL from hiding a failed cleanup. Retain the guarded role creation because Supabase local reset does not remove cluster roles and every review/final verification must be repeatable. Do not add `reassign owned`, `drop owned`, extension cleanup, or any production credential handling: the disposable local rollback must fail rather than delete an unexpected surviving dependency, and `pgcrypto` is managed outside this Foundation boundary.

- [ ] **Step 4: Run every Task 5 verification command**

```bash
npx supabase db reset
npx supabase test db
npx supabase migration down --local --last 1 --yes
npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
npx supabase migration up --local
npx supabase test db
npm run test -w @wison/contracts
git diff --check
git status --short
```

Expected: every command exits 0; pgTAP reports 33 passing assertions before and after the local baseline is rolled back one migration, its version-matched cluster-role cleanup is applied, and the baseline is replayed. The explicit rollback pgTAP reports two passes and proves both `app_private` and `app_runtime` are absent at the no-object anchor boundary. This is the unreleased additive Foundation migration rehearsal; it is not a production rollback claim. Task 2 contracts still pass, and only the six Task 5 paths are changed.

- [ ] **Step 5: Commit with the specified message**

```bash
git add supabase/config.toml supabase/tests/platform_foundation_test.sql supabase/rollback/202607310001_platform_foundation_down.sql supabase/rollback-tests/platform_foundation_absent_test.sql supabase/migrations/202607310000_foundation_anchor.sql supabase/migrations/202607310001_platform_foundation.sql
git commit -m "feat: add private governance schema"
```

- [ ] **Step 6: Complete the Task gate**

Run requirements and database/security code-quality reviews. Resolve all Critical/Important findings and rerun Step 4 before Task 6.

---

### Task 6: Add asymmetric JWT/JWKS verification and Hyperdrive request context

**Files:**
- Modify: `apps/api/package.json`
- Modify: `package-lock.json`
- Modify: `apps/api/src/types.ts`
- Modify: `apps/api/src/app.ts`
- Modify: `apps/api/tsconfig.json`
- Modify: `apps/api/vitest.config.ts`
- Create: `apps/api/vitest.integration.config.ts`
- Create: `apps/api/src/auth/types.ts`
- Create: `apps/api/src/auth/jwt-verifier.ts`
- Create: `apps/api/src/auth/database-context.ts`
- Create: `apps/api/src/auth/permission-loader.ts`
- Create: `apps/api/src/middleware/authentication.ts`
- Create: `apps/api/src/middleware/require-permission.ts`
- Create: `apps/api/src/routes/me.ts`
- Create: `apps/api/test/jwt-verifier.test.ts`
- Create: `apps/api/test/database-context.test.ts`
- Create: `apps/api/test/authentication.test.ts`
- Create: `apps/api/test/permission-loader.test.ts`
- Create: `apps/api/test/database-context.integration.test.ts`

**Interfaces:**
- Consumes: `app_private.get_current_user_context()`, exact Task 2 schemas, Hono request IDs, and the `connectionString` interface exposed by a future Hyperdrive binding. Cache-disabled resource configuration is external G4 evidence, not inferred from this string.
- Produces: `VerifiedIdentity`, `TokenVerifier`, `PermissionLoader`, safe bearer middleware, same-client transaction helper, explicit permission guard, and protected `GET /api/v1/me`.
- Defers: real production signing-key migration/rotation, enterprise login/MFA/session revocation, real Hyperdrive creation/TLS/network restrictions/credentials, teams/subscriptions/record grants, and authorization caching.

- [ ] **Step 1: Write the failing JWT, SQL-order, permission-loader, integration, and authorization tests**

Create `apps/api/test/database-context.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { withDatabaseContext, type SqlClient } from '../src/auth/database-context';

function mockClient(failOnProtectedQuery = false) {
  const calls: Array<[string, readonly unknown[] | undefined]> = [];
  const client: SqlClient = {
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    query: vi.fn(async (text: string, values?: readonly unknown[]) => {
      calls.push([text, values]);
      if (failOnProtectedQuery && text === 'select protected') throw new Error('db failure');
      return { rows: [] };
    }),
  };
  return { calls, client };
}

const identity = { userId: '00000000-0000-4000-8000-000000000001' };

describe('withDatabaseContext', () => {
  it('uses one client and the exact transaction-local context order', async () => {
    const { calls, client } = mockClient();
    await withDatabaseContext(
      { connectionString: 'postgres://local' },
      identity,
      'req_database_12345678',
      (sql) => sql.query('select protected'),
      () => client,
    );

    expect(calls).toEqual([
      ['BEGIN', undefined],
      ['SET LOCAL ROLE app_runtime', undefined],
      ["select set_config('app.user_id', $1, true)", [identity.userId]],
      ["select set_config('app.request_id', $1, true)", ['req_database_12345678']],
      ['select protected', undefined],
      ['COMMIT', undefined],
    ]);
    expect(client.end).toHaveBeenCalledOnce();
  });

  it('rolls back and closes the client on a protected-query error', async () => {
    const { calls, client } = mockClient(true);
    await expect(
      withDatabaseContext(
        { connectionString: 'postgres://local' },
        identity,
        'req_database_12345678',
        (sql) => sql.query('select protected'),
        () => client,
      ),
    ).rejects.toThrow('db failure');
    expect(calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(client.end).toHaveBeenCalledOnce();
  });

  it('still closes the client when connect fails', async () => {
    const { calls, client } = mockClient();
    vi.mocked(client.connect).mockRejectedValueOnce(new Error('connect failure'));
    await expect(
      withDatabaseContext(
        { connectionString: 'postgres://local' },
        identity,
        'req_database_12345678',
        (sql) => sql.query('select protected'),
        () => client,
      ),
    ).rejects.toThrow('connect failure');
    expect(calls).toEqual([]);
    expect(client.end).toHaveBeenCalledOnce();
  });
});
```

Replace `apps/api/vitest.config.ts` so normal unit/contract runs never require a live database:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    exclude: ['**/dist/**', '**/node_modules/**', 'test/**/*.integration.test.ts'],
    include: ['test/**/*.test.ts'],
  },
});
```

Create `apps/api/vitest.integration.config.ts` as the only database-test entry point:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    fileParallelism: false,
    include: ['test/database-context.integration.test.ts'],
  },
});
```

Change the API `tsconfig.json` include list so both checked-in Vitest configs are type-checked:

```json
"include": ["src", "test", "vitest*.config.ts"]
```

Create `apps/api/test/jwt-verifier.test.ts` with a local asymmetric key set; it exercises real JOSE verification without network access:

```ts
import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
} from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearJwksResolverCache,
  createTokenVerifier,
  type JwtBindings,
} from '../src/auth/jwt-verifier';

const bindings: JwtBindings = {
  JWT_ALGORITHM: 'ES256',
  JWKS_CACHE_EPOCH: 'v1',
  SUPABASE_AUDIENCE: 'authenticated',
  SUPABASE_ISSUER: 'https://project.supabase.co/auth/v1',
};
const userId = '00000000-0000-4000-8000-000000000001';

interface TokenOptions {
  audience?: string;
  expiration?: string | number;
  includeExpiration?: boolean;
  includeSubject?: boolean;
  issuer?: string;
}

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const { privateKey: wrongPrivateKey } = await generateKeyPair('ES256');
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test-key' };
  const resolver = createLocalJWKSet({ keys: [publicJwk] });

  const build = (claims: Record<string, unknown> = {}, options: TokenOptions = {}) => {
    const payload = options.includeSubject === false ? claims : { sub: userId, ...claims };
    let token = new SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(options.issuer ?? bindings.SUPABASE_ISSUER)
      .setAudience(options.audience ?? bindings.SUPABASE_AUDIENCE)
      .setIssuedAt();
    if (options.includeExpiration !== false) {
      token = token.setExpirationTime(options.expiration ?? '5m');
    }
    return token;
  };

  const invalidTokens = new Map<string, string>([
    ['wrong issuer', await build({}, { issuer: 'https://wrong.example' }).sign(privateKey)],
    ['missing sub', await build({}, { includeSubject: false }).sign(privateKey)],
    ['missing exp', await build({}, { includeExpiration: false }).sign(privateKey)],
    ['expired', await build({}, { expiration: Math.floor(Date.now() / 1000) - 60 }).sign(privateKey)],
    ['malformed sub', await build({ sub: 'not-a-uuid' }).sign(privateKey)],
    ['wrong audience', await build({}, { audience: 'wrong-audience' }).sign(privateKey)],
    ['wrong signature', await build().sign(wrongPrivateKey)],
    [
      'HS256',
      await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
        .setIssuer(bindings.SUPABASE_ISSUER)
        .setAudience(bindings.SUPABASE_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('foundation-test-only-hs256-secret')),
    ],
  ]);

  return {
    invalidTokens,
    resolver,
    validToken: await build().sign(privateKey),
  };
}

beforeEach(() => clearJwksResolverCache());

describe('Supabase JWT verifier', () => {
  it('accepts a correctly signed asymmetric token with UUID sub', async () => {
    const { resolver, validToken } = await fixture();
    const verifier = createTokenVerifier(bindings, () => resolver);
    await expect(verifier.verify(validToken)).resolves.toEqual({ userId });
  });

  it.each([
    'wrong issuer',
    'missing sub',
    'missing exp',
    'expired',
    'malformed sub',
    'wrong audience',
    'wrong signature',
    'HS256',
  ])('rejects %s', async (name) => {
    const { invalidTokens, resolver } = await fixture();
    const verifier = createTokenVerifier(bindings, () => resolver);
    const token = invalidTokens.get(name);
    expect(token).toBeDefined();
    await expect(verifier.verify(token!)).rejects.toThrow();
  });

  it('reuses a JWKS resolver until cache epoch changes', async () => {
    const { resolver } = await fixture();
    const factory = vi.fn(() => resolver);
    createTokenVerifier(bindings, factory);
    createTokenVerifier(bindings, factory);
    createTokenVerifier({ ...bindings, JWKS_CACHE_EPOCH: 'v2' }, factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('derives the project JWKS endpoint from the only trusted issuer URL', async () => {
    const { resolver } = await fixture();
    const factory = vi.fn(() => resolver);
    createTokenVerifier(bindings, factory);
    expect(factory).toHaveBeenCalledWith(
      new URL('https://project.supabase.co/auth/v1/.well-known/jwks.json'),
    );
  });

  it('accepts the other approved asymmetric algorithm', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk: JWK = { ...(await exportJWK(publicKey)), alg: 'RS256', kid: 'rsa-key' };
    const resolver = createLocalJWKSet({ keys: [publicJwk] });
    const token = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'RS256', kid: 'rsa-key' })
      .setIssuer(bindings.SUPABASE_ISSUER)
      .setAudience(bindings.SUPABASE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const verifier = createTokenVerifier({ ...bindings, JWT_ALGORITHM: 'RS256' }, () => resolver);
    await expect(verifier.verify(token)).resolves.toEqual({ userId });
  });

  it('rejects unapproved algorithms and invalid issuer endpoints', () => {
    expect(() => createTokenVerifier({ ...bindings, JWT_ALGORITHM: 'HS256' })).toThrow(
      'JWT algorithm configuration is not approved.',
    );
    expect(() => createTokenVerifier({
      ...bindings,
      SUPABASE_ISSUER: 'http://project.supabase.co/auth/v1',
    })).toThrow('Supabase issuer must use HTTPS.');
    expect(() => createTokenVerifier({
      ...bindings,
      SUPABASE_ISSUER: 'ftp://localhost/auth/v1',
    })).toThrow('Supabase issuer must use HTTPS.');
    expect(() => createTokenVerifier({
      ...bindings,
      SUPABASE_ISSUER: 'https://project.supabase.co/not-auth',
    })).toThrow('Supabase issuer must end at /auth/v1.');
  });
});
```

Create `apps/api/test/authentication.test.ts`:

```ts
import {
  ApiErrorResponseSchema,
  UserContextSchema,
  type Permission,
  type Role,
} from '@wison/contracts';
import type { PermissionLoader, TokenVerifier } from '../src/auth/types';
import { AppError } from '../src/lib/app-error';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

const identity = { userId: '00000000-0000-4000-8000-000000000001' };
const user = UserContextSchema.parse({
  userId: identity.userId,
  email: 'user@example.com',
  roles: ['sales_bd'],
  permissions: ['platform.access'],
});

function appWith(options: {
  factoryError?: Error;
  loaderError?: Error;
  permissions?: Permission[];
  roles?: Role[];
  verifierError?: Error;
} = {}) {
  const verifier: TokenVerifier = {
    verify: vi.fn(async () => {
      if (options.verifierError) throw options.verifierError;
      return identity;
    }),
  };
  const loader: PermissionLoader = {
    load: vi.fn(async () => {
      if (options.loaderError) throw options.loaderError;
      return {
        ...user,
        permissions: options.permissions ?? user.permissions,
        roles: options.roles ?? user.roles,
      };
    }),
  };
  return createApp(() => {
    if (options.factoryError) throw options.factoryError;
    return { loader, verifier };
  });
}

describe('GET /api/v1/me', () => {
  it.each([undefined, 'Basic abc', 'Bearer', 'Bearer a b'])(
    'rejects missing or malformed bearer %s',
    async (authorization) => {
      const headers = authorization ? { authorization } : undefined;
      expect((await appWith().request('/api/v1/me', { headers })).status).toBe(401);
    },
  );

  it('keeps future child paths inside the same authentication boundary', async () => {
    expect((await appWith().request('/api/v1/me/future-child')).status).toBe(401);
  });

  it('requires explicit platform.access even for super_admin', async () => {
    const response = await appWith({ permissions: [], roles: ['super_admin'] }).request('/api/v1/me', {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('platform.access');
  });

  it('returns the strict user context for an explicitly permitted user', async () => {
    const response = await appWith().request('/api/v1/me', {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(user);
  });

  it('collapses verifier details into the safe unauthorized envelope', async () => {
    const response = await appWith({ verifierError: new Error('sensitive JOSE detail') }).request(
      '/api/v1/me',
      { headers: { authorization: 'Bearer token' } },
    );
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Authentication is required.');
    expect(JSON.stringify(body)).not.toContain('sensitive JOSE detail');
  });

  it('collapses permission-loader failures into the safe internal-error envelope', async () => {
    const response = await appWith({ loaderError: new Error('sensitive PostgreSQL detail') }).request(
      '/api/v1/me',
      { headers: { authorization: 'Bearer token' } },
    );
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('sensitive PostgreSQL detail');
  });

  it('preserves an explicit loader denial as the safe forbidden envelope', async () => {
    const response = await appWith({
      loaderError: new AppError('FORBIDDEN', 403, 'Access is not permitted.'),
    }).request('/api/v1/me', { headers: { authorization: 'Bearer token' } });
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({ code: 'FORBIDDEN', message: 'Access is not permitted.' });
  });

  it('collapses auth-service configuration failures into the safe internal envelope', async () => {
    const response = await appWith({
      factoryError: new Error('sensitive binding detail'),
    }).request('/api/v1/me', { headers: { authorization: 'Bearer token' } });
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('sensitive binding detail');
  });
});
```

Create `apps/api/test/permission-loader.test.ts` before the RED run:

```ts
import { describe, expect, it } from 'vitest';
import { parsePermissionContext } from '../src/auth/permission-loader';
import { AppError } from '../src/lib/app-error';

const identity = { userId: '00000000-0000-4000-8000-000000000001' };
const valid = {
  email: 'user@example.com',
  permissions: ['platform.access'],
  roles: ['sales_bd'],
  userId: identity.userId,
};

describe('parsePermissionContext', () => {
  it('accepts the strict context for the verified identity', () => {
    expect(parsePermissionContext(identity, valid)).toEqual(valid);
  });

  it.each([null, undefined])('maps absent context %s to an explicit forbidden error', (value) => {
    let caught: unknown;
    try {
      parsePermissionContext(identity, value);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(AppError);
    expect(caught).toMatchObject({
      code: 'FORBIDDEN',
      message: 'Access is not permitted.',
      status: 403,
    });
  });

  it.each([
    { ...valid, extra: true },
    { ...valid, permissions: ['unknown.permission'] },
    { ...valid, userId: '00000000-0000-4000-8000-000000000002' },
  ])('rejects malformed or mismatched database context as an internal invariant failure', (value) => {
    expect(() => parsePermissionContext(identity, value)).toThrow('Permission context is invalid.');
  });
});
```

Create `apps/api/test/database-context.integration.test.ts`:

```ts
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPermissionLoader } from '../src/auth/permission-loader';

const connectionString = 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const userId = '00000000-0000-4000-8000-000000000010';
const admin = new Client({ connectionString });

beforeAll(async () => {
  await admin.connect();
  await admin.query('delete from app_private.profiles where user_id = $1', [userId]);
  await admin.query(
    "insert into app_private.profiles (user_id, email, status) values ($1, 'integration@example.com', 'active')",
    [userId],
  );
  await admin.query(
    "insert into app_private.user_roles (user_id, role_code) values ($1, 'sales_bd')",
    [userId],
  );
});

afterAll(async () => {
  await admin.query('delete from app_private.profiles where user_id = $1', [userId]);
  await admin.end();
});

describe('local PostgreSQL context integration', () => {
  it('loads a strict context through the production loader, one transaction, and app_runtime RLS', async () => {
    const result = await createPermissionLoader({ connectionString }).load(
      { userId },
      'req_integration_12345678',
    );
    expect(result).toEqual({
      email: 'integration@example.com',
      permissions: ['platform.access'],
      roles: ['sales_bd'],
      userId,
    });
  });
});
```

- [ ] **Step 2: Run the unit tests and confirm the expected RED**

```bash
npm run test -w @wison/api
```

Expected: FAIL because the auth/database modules and `/api/v1/me` do not exist. Diagnose and recover any unrelated failure before accepting the RED.

- [ ] **Step 3: Replace the Data API dependency, then confirm the integration RED**

Run serially under Node `22.23.2`/npm `10.9.8`:

```bash
npm uninstall -w @wison/api @supabase/supabase-js
npm install -w @wison/api pg@8.22.0
npm install -D -w @wison/api @types/pg@8.20.0
```

Add this API script:

```json
"test:db": "vitest run --config vitest.integration.config.ts"
```

Run the integration entry point before implementation:

```bash
npm run test:db -w @wison/api
```

Expected: FAIL because `src/auth/permission-loader.ts` and the database-context implementation do not exist. Package-install, configuration, syntax, or other unrelated failures must be diagnosed and recovered before accepting the RED.

- [ ] **Step 4: Implement the fixed auth and database interfaces**

Create `apps/api/src/auth/types.ts`:

```ts
import type { UserContext } from '@wison/contracts';

export interface VerifiedIdentity { userId: string }
export interface TokenVerifier { verify(token: string): Promise<VerifiedIdentity> }
export interface PermissionLoader {
  load(identity: VerifiedIdentity, requestId: string): Promise<UserContext>;
}
```

Replace `apps/api/src/types.ts` with:

```ts
import type { UserContext } from '@wison/contracts';
import type { VerifiedIdentity } from './auth/types';

export interface AppBindings {
  APP_VERSION: string;
  HYPERDRIVE: Hyperdrive;
  JWT_ALGORITHM: string;
  JWKS_CACHE_EPOCH: string;
  SUPABASE_AUDIENCE: string;
  SUPABASE_ISSUER: string;
}
export interface AppVariables {
  identity: VerifiedIdentity;
  requestId: string;
  user: UserContext;
}
export type AppEnvironment = { Bindings: AppBindings; Variables: AppVariables };
```

Create `apps/api/src/auth/jwt-verifier.ts`:

```ts
import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { TokenVerifier } from './types';

export interface JwtBindings {
  JWT_ALGORITHM: string;
  JWKS_CACHE_EPOCH: string;
  SUPABASE_AUDIENCE: string;
  SUPABASE_ISSUER: string;
}
const resolverCache = new Map<string, JWTVerifyGetKey>();
export function clearJwksResolverCache() { resolverCache.clear(); }

export function createTokenVerifier(
  bindings: JwtBindings,
  resolverFactory: (url: URL) => JWTVerifyGetKey = (url) =>
    createRemoteJWKSet(url, { cacheMaxAge: 600_000 }),
): TokenVerifier {
  if (!['ES256', 'RS256'].includes(bindings.JWT_ALGORITHM)) {
    throw new Error('JWT algorithm configuration is not approved.');
  }
  const issuerUrl = new URL(bindings.SUPABASE_ISSUER);
  const isLoopback = ['127.0.0.1', 'localhost'].includes(issuerUrl.hostname);
  const isAllowedProtocol =
    issuerUrl.protocol === 'https:' || (issuerUrl.protocol === 'http:' && isLoopback);
  if (!isAllowedProtocol) {
    throw new Error('Supabase issuer must use HTTPS.');
  }
  if (
    issuerUrl.pathname.replace(/\/+$/, '') !== '/auth/v1' ||
    issuerUrl.search || issuerUrl.hash || issuerUrl.username || issuerUrl.password
  ) {
    throw new Error('Supabase issuer must end at /auth/v1.');
  }
  const normalizedIssuer = issuerUrl.href.replace(/\/+$/, '');
  const jwksUrl = new URL(`${normalizedIssuer}/.well-known/jwks.json`);
  const key = `${jwksUrl.href}:${bindings.JWKS_CACHE_EPOCH}`;
  let resolver = resolverCache.get(key);
  if (!resolver) {
    resolver = resolverFactory(jwksUrl);
    resolverCache.set(key, resolver);
  }
  return {
    async verify(token) {
      const result = await jwtVerify(token, resolver, {
        algorithms: [bindings.JWT_ALGORITHM],
        audience: bindings.SUPABASE_AUDIENCE,
        issuer: normalizedIssuer,
        requiredClaims: ['exp', 'sub'],
      });
      return { userId: z.uuid().parse(result.payload.sub) };
    },
  };
}
```

Create `apps/api/src/auth/database-context.ts`:

```ts
import { Client } from 'pg';
import type { VerifiedIdentity } from './types';

export interface SqlResult<Row extends Record<string, unknown> = Record<string, unknown>> { rows: Row[] }
export interface SqlClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
}
export interface DatabaseBinding { connectionString: string }

export async function withDatabaseContext<T>(
  binding: DatabaseBinding,
  identity: VerifiedIdentity,
  requestId: string,
  run: (client: SqlClient) => Promise<T>,
  createClient: (connectionString: string) => SqlClient = (connectionString) =>
    new Client({ connectionString }) as unknown as SqlClient,
): Promise<T> {
  const client = createClient(binding.connectionString);
  let began = false;
  let primaryError: unknown;
  try {
    await client.connect();
    await client.query('BEGIN');
    began = true;
    await client.query('SET LOCAL ROLE app_runtime');
    await client.query("select set_config('app.user_id', $1, true)", [identity.userId]);
    await client.query("select set_config('app.request_id', $1, true)", [requestId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    primaryError = error;
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        primaryError = new AggregateError(
          [error, rollbackError],
          'Database operation and rollback both failed.',
        );
      }
    }
    throw primaryError;
  } finally {
    try {
      await client.end();
    } catch (closeError) {
      if (primaryError === undefined) throw closeError;
      throw new AggregateError(
        [primaryError, closeError],
        'Database operation and cleanup both failed.',
      );
    }
  }
}
```

Create `apps/api/src/auth/permission-loader.ts`:

```ts
import { UserContextSchema, type UserContext } from '@wison/contracts';
import { AppError } from '../lib/app-error';
import { withDatabaseContext, type DatabaseBinding } from './database-context';
import type { PermissionLoader, VerifiedIdentity } from './types';

export function parsePermissionContext(
  identity: VerifiedIdentity,
  value: unknown,
): UserContext {
  if (value === null || value === undefined) {
    throw new AppError('FORBIDDEN', 403, 'Access is not permitted.');
  }
  const parsed = UserContextSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== identity.userId) {
    throw new Error('Permission context is invalid.');
  }
  return parsed.data;
}

export function createPermissionLoader(binding: DatabaseBinding): PermissionLoader {
  return {
    load(identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const result = await client.query<{ context: unknown }>(
          'select app_private.get_current_user_context() as context',
        );
        return parsePermissionContext(identity, result.rows[0]?.context);
      });
    },
  };
}
```

Create `apps/api/src/middleware/authentication.ts`, `require-permission.ts`, and `routes/me.ts`:

```ts
// authentication.ts
import { AppError } from '../lib/app-error';
import { createMiddleware } from 'hono/factory';
import type { AppEnvironment } from '../types';
import type { PermissionLoader, TokenVerifier, VerifiedIdentity } from '../auth/types';

export interface AuthServices { loader: PermissionLoader; verifier: TokenVerifier }
export type AuthServicesFactory = (env: AppEnvironment['Bindings']) => AuthServices;
export const authentication = (getServices: AuthServicesFactory) =>
  createMiddleware<AppEnvironment>(async (context, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(context.req.header('authorization') ?? '');
    const token = match?.[1];
    if (!token) throw new AppError('UNAUTHORIZED', 401, 'Authentication is required.');
    const services = getServices(context.env);
    let identity: VerifiedIdentity;
    try {
      identity = await services.verifier.verify(token);
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication is required.');
    }
    const user = await services.loader.load(identity, context.get('requestId'));
    context.set('identity', identity);
    context.set('user', user);
    await next();
  });
```

```ts
// require-permission.ts
import type { Permission } from '@wison/contracts';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

export const requirePermission = (permission: Permission) =>
  createMiddleware<AppEnvironment>(async (context, next) => {
    if (!context.get('user').permissions.includes(permission)) {
      throw new AppError('FORBIDDEN', 403, 'Access is not permitted.');
    }
    await next();
  });
```

```ts
// me.ts
import { Hono } from 'hono';
import type { AppEnvironment } from '../types';
export const meRoutes = new Hono<AppEnvironment>().get('/', (context) => {
  context.header('cache-control', 'private, no-store');
  return context.json(context.get('user'));
});
```

Replace `apps/api/src/app.ts` with the complete route composition below. It keeps the bearer token out of Hono variables and collapses JOSE/PostgreSQL details into stable error envelopes:

```ts
import type { ApiErrorResponse } from '@wison/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createPermissionLoader } from './auth/permission-loader';
import { createTokenVerifier } from './auth/jwt-verifier';
import { AppError } from './lib/app-error';
import { authentication, type AuthServicesFactory } from './middleware/authentication';
import { requestIdMiddleware } from './middleware/request-id';
import { requirePermission } from './middleware/require-permission';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
import type { AppEnvironment } from './types';

const createDefaultAuthServices: AuthServicesFactory = (bindings) => ({
  loader: createPermissionLoader(bindings.HYPERDRIVE),
  verifier: createTokenVerifier(bindings),
});

export function createApp(
  getAuthServices: AuthServicesFactory = createDefaultAuthServices,
): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());
  app.route('/api/v1/health', healthRoutes);

  const protectedMe = new Hono<AppEnvironment>();
  protectedMe.use('*', authentication(getAuthServices));
  protectedMe.use('*', requirePermission('platform.access'));
  protectedMe.route('/', meRoutes);
  app.route('/api/v1/me', protectedMe);

  app.notFound((context) => {
    const response: ApiErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route does not exist.',
        requestId: context.get('requestId'),
      },
    };
    return context.json(response, 404);
  });

  app.onError((error, context) => {
    const appError = error instanceof AppError
      ? error
      : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');
    const response: ApiErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        requestId: context.get('requestId'),
      },
    };
    context.header('x-request-id', context.get('requestId'));
    return context.json(response, appError.status);
  });

  return app;
}
```

- [ ] **Step 5: Complete local integration setup and verify**

The integration test above creates its one synthetic active user and explicit `sales_bd` role in `beforeAll`, deletes it in `afterAll`, and keeps all fixture data out of the production migration. Then run:

```bash
npx supabase db reset
npm run test -w @wison/api
npm run test:db -w @wison/api
npm run typecheck -w @wison/api
npm run lint -w @wison/api
npm run build
node --test tests/worker-artifact.integration.mjs
git diff --check
git status --short
```

Expected: every command exits 0; ES256/RS256 positives, all named JWT negative cases, secure project-JWKS configuration, JWKS epoch caching, SQL order/rollback/close, strict permission-context invariants, explicit `platform.access`, and the production permission loader against real local PostgreSQL all pass. The live no-bundle Worker artifact still starts with the new Node-compatible dependencies and runtime bindings. No test is skipped. This proves local driver/transaction behavior, not a real Cloudflare Hyperdrive resource.

- [ ] **Step 6: Commit with the specified message**

```bash
git add apps/api package-lock.json
git commit -m "feat: enforce authenticated platform access"
```

- [ ] **Step 7: Complete the Task gate**

Run requirements plus security/code-quality reviews. Resolve all Critical/Important findings and rerun Step 5 before Task 7.

---

### Task 7: Add separate private published and quarantine R2 adapters

**Files:**
- Modify: `apps/api/wrangler.jsonc`
- Modify: `apps/api/src/types.ts`
- Modify: `tests/worker-artifact.test.mjs`
- Create: `apps/api/src/storage/object-storage.ts`
- Create: `apps/api/src/storage/r2-object-storage.ts`
- Create: `apps/api/src/storage/create-object-stores.ts`
- Create: `apps/api/test/r2-object-storage.test.ts`

**Interfaces:**
- Consumes: two fixed private bindings, `FILES` and `QUARANTINE_FILES`.
- Produces: provider-neutral `ObjectStorage`, `StoredObject`, and `createObjectStores(bindings) -> { published, quarantine }`.
- Defers: upload/file routes, scanning, promotion/copy, preview/download/range handling, public or presigned URLs, MIME preview policy, no-store download headers, and production bucket/public-access/lifecycle/DR configuration.

- [ ] **Step 1: Write the failing adapter tests**

Create `apps/api/test/r2-object-storage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createObjectStores } from '../src/storage/create-object-stores';
import { R2ObjectStorage } from '../src/storage/r2-object-storage';
import { createApp } from '../src/app';

const checksum = 'a'.repeat(64);
function bucket(name: string) {
  const body = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array([1])); controller.close(); },
  });
  return {
    name,
    put: vi.fn(async () => undefined),
    head: vi.fn(async () => ({
      customMetadata: { sha256: checksum },
      etag: `${name}-etag`,
      httpMetadata: { contentType: 'application/pdf' },
      size: 1,
      uploaded: new Date('2026-07-31T00:00:00.000Z'),
    })),
    get: vi.fn(async () => ({
      body,
      customMetadata: { sha256: checksum },
      etag: `${name}-etag`,
      httpMetadata: { contentType: 'application/pdf' },
      size: 1,
      uploaded: new Date('2026-07-31T00:00:00.000Z'),
    })),
    delete: vi.fn(async () => undefined),
  };
}

describe('private R2 adapters', () => {
  it('uses fixed published and quarantine bindings without caller bucket selection', async () => {
    const published = bucket('published');
    const quarantine = bucket('quarantine');
    const stores = createObjectStores({
      FILES: published as never,
      QUARANTINE_FILES: quarantine as never,
    });
    await stores.published.head('published-key');
    await stores.quarantine.head('quarantine-key');
    expect(published.head).toHaveBeenCalledWith('published-key');
    expect(quarantine.head).toHaveBeenCalledWith('quarantine-key');
    expect(published.head).not.toHaveBeenCalledWith('quarantine-key');
  });

  it('normalizes transport metadata and exposes a Uint8Array stream', async () => {
    const store = new R2ObjectStorage(bucket('published') as never);
    const object = await store.get('key');
    expect(object).toMatchObject({
      checksumSha256: checksum,
      contentType: 'application/pdf',
      etag: 'published-etag',
      size: 1,
    });
    expect(object?.body).toBeInstanceOf(ReadableStream);
  });

  it.each([undefined, 'bad-checksum'])('fails closed for checksum %s', async (sha256) => {
    const unsafe = bucket('unsafe');
    unsafe.head.mockResolvedValue({
      customMetadata: sha256 === undefined ? {} : { sha256 },
      etag: 'etag',
      httpMetadata: {},
      size: 1,
      uploaded: new Date(),
    } as never);
    await expect(new R2ObjectStorage(unsafe as never).head('key')).rejects.toThrow(
      'Stored object metadata is invalid.',
    );
  });

  it('uses application/octet-stream when content type is absent', async () => {
    const value = bucket('published');
    value.head.mockResolvedValue({
      customMetadata: { sha256: checksum }, etag: 'etag', httpMetadata: {}, size: 1, uploaded: new Date(),
    } as never);
    await expect(new R2ObjectStorage(value as never).head('key')).resolves.toMatchObject({
      contentType: 'application/octet-stream',
    });
  });

  it('writes checksum metadata and deletes only through its fixed bucket', async () => {
    const value = bucket('published');
    const store = new R2ObjectStorage(value as never);
    await store.put('key', 'body', { checksumSha256: checksum, contentType: '' });
    await store.delete('key');
    expect(value.put).toHaveBeenCalledWith('key', 'body', {
      customMetadata: { sha256: checksum },
      httpMetadata: { contentType: 'application/octet-stream' },
    });
    expect(value.delete).toHaveBeenCalledWith('key');
  });

  it('does not create a public file route', async () => {
    const response = await createApp().request('/api/v1/files/anything');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });
  });
});
```

Append this failing structural assertion to the Node-side `tests/worker-artifact.test.mjs`; keeping configuration reads outside the Worker-typed API test avoids adding Node globals to the API workspace:

```js
test('R2 development bindings expose no public route configuration', async () => {
  const wrangler = await readJson('../apps/api/wrangler.jsonc');
  assert.deepEqual(wrangler.r2_buckets, [
    { binding: 'FILES', bucket_name: 'wison-knowledge-files-dev' },
    { binding: 'QUARANTINE_FILES', bucket_name: 'wison-knowledge-quarantine-dev' },
  ]);
  assert.equal(Object.hasOwn(wrangler, 'route'), false);
  assert.equal(Object.hasOwn(wrangler, 'routes'), false);
  assert.equal(Object.hasOwn(wrangler, 'workers_dev'), false);
  assert.equal(Object.hasOwn(wrangler, 'preview_urls'), false);
  for (const binding of wrangler.r2_buckets) {
    assert.deepEqual(Object.keys(binding).sort(), ['binding', 'bucket_name']);
  }
});
```

- [ ] **Step 2: Run the adapter tests and confirm RED**

```bash
npm run test -w @wison/api -- r2-object-storage.test.ts
node --test tests/worker-artifact.test.mjs
```

Expected: both commands FAIL for the scoped missing storage modules and R2 binding declarations. Diagnose and recover unrelated failures before accepting the RED.

- [ ] **Step 3: Define provider-neutral storage types and implementation**

Create `apps/api/src/storage/object-storage.ts`:

```ts
export interface ObjectMetadata {
  checksumSha256: string;
  contentType: string;
}
export interface StoredObjectMetadata extends ObjectMetadata {
  etag: string;
  size: number;
  uploadedAt: string;
}
export interface StoredObject extends StoredObjectMetadata {
  body: ReadableStream<Uint8Array>;
}
export interface ObjectStorage {
  put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string, metadata: ObjectMetadata): Promise<void>;
  head(key: string): Promise<StoredObjectMetadata | null>;
  get(key: string): Promise<StoredObject | null>;
  delete(key: string): Promise<void>;
}
```

Create `apps/api/src/storage/r2-object-storage.ts`:

```ts
import type { ObjectMetadata, ObjectStorage, StoredObject, StoredObjectMetadata } from './object-storage';

const checksumPattern = /^[a-f0-9]{64}$/;
function normalize(object: R2Object): StoredObjectMetadata {
  const checksumSha256 = object.customMetadata?.sha256;
  if (!checksumSha256 || !checksumPattern.test(checksumSha256)) {
    throw new Error('Stored object metadata is invalid.');
  }
  return {
    checksumSha256,
    contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
    etag: object.etag,
    size: object.size,
    uploadedAt: object.uploaded.toISOString(),
  };
}

export class R2ObjectStorage implements ObjectStorage {
  constructor(private readonly bucket: R2Bucket) {}
  async put(key: string, body: ReadableStream<Uint8Array> | ArrayBuffer | string, metadata: ObjectMetadata) {
    if (!checksumPattern.test(metadata.checksumSha256)) throw new Error('Stored object metadata is invalid.');
    await this.bucket.put(key, body, {
      customMetadata: { sha256: metadata.checksumSha256 },
      httpMetadata: { contentType: metadata.contentType || 'application/octet-stream' },
    });
  }
  async head(key: string) {
    const object = await this.bucket.head(key);
    return object ? normalize(object) : null;
  }
  async get(key: string): Promise<StoredObject | null> {
    const object = await this.bucket.get(key);
    if (!object) return null;
    return { ...normalize(object), body: object.body as ReadableStream<Uint8Array> };
  }
  async delete(key: string) { await this.bucket.delete(key); }
}
```

Create `apps/api/src/storage/create-object-stores.ts`:

```ts
import { R2ObjectStorage } from './r2-object-storage';
export interface ObjectStoreBindings { FILES: R2Bucket; QUARANTINE_FILES: R2Bucket }
export function createObjectStores(bindings: ObjectStoreBindings) {
  return {
    published: new R2ObjectStorage(bindings.FILES),
    quarantine: new R2ObjectStorage(bindings.QUARANTINE_FILES),
  } as const;
}
```

Add these exact fields to `AppBindings`:

```ts
FILES: R2Bucket;
QUARANTINE_FILES: R2Bucket;
```

Add this exact sibling property to `apps/api/wrangler.jsonc`:

```jsonc
"r2_buckets": [
  { "binding": "FILES", "bucket_name": "wison-knowledge-files-dev" },
  { "binding": "QUARANTINE_FILES", "bucket_name": "wison-knowledge-quarantine-dev" }
]
```

Do not add a custom domain, Public Development URL, access key, presigned URL, route, production bucket name, security level, rights type, scan status, or retention state.

- [ ] **Step 4: Run every Task 7 verification command**

```bash
npm run test -w @wison/api
npm run typecheck -w @wison/api
npm run lint -w @wison/api
npm run build
node --test tests/worker-artifact.test.mjs
node --test tests/worker-artifact.integration.mjs
git diff --check
git status --short
```

Expected: every command exits 0; exact development binding config, published/quarantine separation, put/head/get/delete behavior, stream normalization, fail-closed metadata, and absence of an API/public Wrangler route are tested; the updated single Worker dry-run artifact also starts and retains same-origin SPA/API behavior. Real bucket public-access state remains an external G4 check and is not claimed here.

- [ ] **Step 5: Commit with the specified message**

```bash
git add apps/api/wrangler.jsonc apps/api/src/types.ts apps/api/src/storage apps/api/test/r2-object-storage.test.ts tests/worker-artifact.test.mjs
git commit -m "feat: add private R2 storage adapters"
```

- [ ] **Step 6: Complete the Task gate**

Run requirements plus storage/security code-quality reviews. Resolve all Critical/Important findings and rerun Step 4 before Task 8.

---

### Task 8: Add browser smoke tests

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/platform-shell.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: the single Worker development server from Tasks 3–4, serving both built React assets and `/api/v1/*` on port 8787.
- Produces: a Chromium engineering smoke test for same-origin shell/API routing. It is not the G2 browser matrix, which remains gated by `PRD-O-08`.

- [ ] **Step 1: Write the failing Playwright smoke test**

Create `e2e/platform-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('loads the platform shell and receives API health', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '市场知识平台' })).toBeVisible();
  const navigation = page.getByRole('navigation', { name: '主导航' });
  await expect(navigation.getByRole('link')).toHaveCount(3);
  await expect(navigation.getByRole('link', { name: '首页' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '公司信息库' })).toBeVisible();
  await expect(navigation.getByRole('link', { name: '行业报告库' })).toBeVisible();
  await expect(page.getByRole('link', { name: '管理中心' })).toHaveCount(0);
  await expect(page.getByText('API 正常')).toBeVisible();
});

test('serves SPA deep links and keeps unknown API routes as JSON 404', async ({ page }) => {
  await page.goto('/reports');
  await expect(page.getByRole('heading', { name: '行业报告库' })).toBeVisible();

  const health = await page.request.get('/api/v1/health');
  expect(health.status()).toBe(200);
  expect(await health.json()).toMatchObject({ status: 'ok', service: 'api' });

  const missingApi = await page.request.get('/api/v1/not-a-route');
  expect(missingApi.status()).toBe(404);
  expect(missingApi.headers()['content-type']).toContain('application/json');
  expect(await missingApi.json()).toMatchObject({ error: { code: 'NOT_FOUND' } });

  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: '无权访问' })).toBeVisible();
});
```

- [ ] **Step 2: Run the smoke test and confirm the expected RED**

Run:

```bash
npx playwright install chromium
npm run e2e
```

Expected: browser installation exits 0, then `npm run e2e` FAILS because `playwright.config.ts`, its absolute base URL, and the single-Worker test server configuration do not exist. Any unrelated failure keeps Task 8 open for root-cause diagnosis and recovery before this RED is accepted.

- [ ] **Step 3: Add the single-origin Playwright configuration**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run build && npm run dev -w @wison/api -- --port 8787',
    url: 'http://127.0.0.1:8787/api/v1/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
```

Add this root script to `package.json`:

```json
"e2e:install": "playwright install chromium"
```

- [ ] **Step 4: Install Chromium and run the smoke test**

Run:

```bash
npm run e2e:install
npm run e2e
```

Expected: PASS, 2 Chromium tests. The Worker serves the SPA and API from the same origin; no production deployment or external domain is used.

- [ ] **Step 5: Run all Task 8 verification commands**

Run:

```bash
npm run typecheck
npm test
npm run build
npm run e2e
git diff --check
git status --short
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit with the specified message**

```bash
git add playwright.config.ts e2e package.json package-lock.json
git commit -m "test: add platform browser smoke test"
```

- [ ] **Step 7: Complete the Task gate**

Run requirements and code-quality reviews, resolve all Critical/Important findings, and rerun Step 5 before Task 9.

---

### Task 9: Add continuous integration

**Files:**
- Create: `.github/workflows/platform-ci.yml`
- Create: `tests/ci-workflow.test.mjs`
- Create: `tests/security-boundaries.test.mjs`

**Interfaces:**
- Consumes: root verification scripts, Supabase CLI tests, and Playwright tests.
- Produces: pull-request CI jobs for workspace verification, database verification, and browser smoke testing.

- [ ] **Step 1: Write the failing CI workflow test**

Create `tests/ci-workflow.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('platform CI runs code, database, and browser verification', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/platform-ci.yml', import.meta.url),
    'utf8',
  );

  for (const required of [
    "node-version: '22.23.2'",
    'npm install --global npm@10.9.8 --no-audit --no-fund',
    'npm ci --engine-strict --no-audit --no-fund',
    'npm ls --all',
    'node --test tests/security-boundaries.test.mjs',
    'npm run lint',
    'npm run typecheck',
    'npm test',
    'npm run build',
    'node --test tests/worker-artifact.integration.mjs',
    'npx supabase db reset',
    'npx supabase test db',
    'npx supabase migration down --local --last 1 --yes',
    'npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql',
    'npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql',
    'npx supabase migration up --local',
    'npm run test:db -w @wison/api',
    'npm run e2e',
  ]) {
    assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.equal(
    workflow.match(/npm install --global npm@10\.9\.8 --no-audit --no-fund/g)?.length,
    3,
  );
  assert.equal(
    workflow.match(/test "\$\(node --version\)" = "v22\.23\.2" && test "\$\(npm --version\)" = "10\.9\.8"/g)?.length,
    3,
  );
  assert.equal(workflow.match(/^\s+- run: npx supabase test db$/gm)?.length, 2);
  assert.doesNotMatch(workflow, /^\s+paths:/m);
});
```

Create `tests/security-boundaries.test.mjs`:

```js
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const allowedEnvironmentFiles = new Set(['.dev.vars.example', '.env.example', '.env.test']);

function assertSafeTrackedName(path) {
  const basename = path.split('/').at(-1) ?? path;
  const lower = basename.toLowerCase();
  const looksLikeEnvironment =
    lower === '.dev.vars' || lower.startsWith('.dev.vars.') ||
    lower === '.env' || lower.startsWith('.env.') || lower.endsWith('.env');
  if (looksLikeEnvironment) {
    assert.ok(allowedEnvironmentFiles.has(lower), `tracked environment file: ${path}`);
  }
  assert.doesNotMatch(basename, /(^|[._-])(credentials?|secrets?)([._-]|$)/i);
}

function assertSafeText(content) {
  assert.doesNotMatch(content, /-----BEGIN (?:EC |RSA |OPENSSH )?PRIVATE KEY-----/);
  assert.doesNotMatch(
    content,
    /^(?:CLOUDFLARE_API_TOKEN|DATABASE_URL|R2_SECRET_ACCESS_KEY|SUPABASE_SERVICE_ROLE_KEY)=\S+/m,
  );
}

test('tracked source excludes local secret files and obvious credential material', async () => {
  const tracked = execFileSync('git', ['ls-files', '-z'], {
    cwd: repositoryRoot,
    encoding: 'utf8',
  }).split('\0').filter(Boolean);

  for (const path of tracked) {
    assertSafeTrackedName(path);
    const content = await readFile(resolve(repositoryRoot, path));
    if (!content.includes(0)) assertSafeText(content.toString('utf8'));
  }
});

test('secret scanner covers deceptive names and credential content', () => {
  for (const path of ['apps/api/.dev.vars', 'prod.env', 'credentials.txt', 'release-secrets']) {
    assert.throws(() => assertSafeTrackedName(path));
  }
  for (const path of ['.env.example', '.env.test', '.dev.vars.example', 'docs/security.md']) {
    assert.doesNotThrow(() => assertSafeTrackedName(path));
  }
  assert.throws(() => assertSafeText(['CLOUDFLARE_API', 'TOKEN=real-looking-value'].join('_')));
  assert.throws(() => assertSafeText(['-----BEGIN', 'PRIVATE KEY-----'].join(' ')));
});
```

- [ ] **Step 2: Run the CI workflow test and verify it fails**

Run:

```bash
node --test tests/ci-workflow.test.mjs
```

Expected: FAIL because `.github/workflows/platform-ci.yml` does not exist.

- [ ] **Step 3: Create the CI workflow**

Create `.github/workflows/platform-ci.yml`:

```yaml
name: Platform CI

permissions:
  contents: read

on:
  pull_request:
  push:
    branches: [main]

jobs:
  code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '22.23.2'
          cache: npm
      - run: npm install --global npm@10.9.8 --no-audit --no-fund
      - run: test "$(node --version)" = "v22.23.2" && test "$(npm --version)" = "10.9.8"
      - run: npm ci --engine-strict --no-audit --no-fund
      - run: npm ls --all
      - run: node --test tests/security-boundaries.test.mjs
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: node --test tests/worker-artifact.integration.mjs

  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '22.23.2'
          cache: npm
      - run: npm install --global npm@10.9.8 --no-audit --no-fund
      - run: test "$(node --version)" = "v22.23.2" && test "$(npm --version)" = "10.9.8"
      - run: npm ci --engine-strict --no-audit --no-fund
      - run: npx supabase start
      - run: npx supabase db reset
      - run: npx supabase test db
      - run: npx supabase migration down --local --last 1 --yes
      - run: npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
      - run: npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
      - run: npx supabase migration up --local
      - run: npx supabase test db
      - run: npm run test:db -w @wison/api

  browser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: '22.23.2'
          cache: npm
      - run: npm install --global npm@10.9.8 --no-audit --no-fund
      - run: test "$(node --version)" = "v22.23.2" && test "$(npm --version)" = "10.9.8"
      - run: npm ci --engine-strict --no-audit --no-fund
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
```

- [ ] **Step 4: Run the workflow test and complete local verification**

Run:

```bash
node --test tests/ci-workflow.test.mjs
npm ls --all
node --test tests/security-boundaries.test.mjs
npm run lint
npm run typecheck
npm test
npm run build
node --test tests/worker-artifact.integration.mjs
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase migration down --local --last 1 --yes
npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
npx supabase migration up --local
npx supabase test db
npm run test:db -w @wison/api
npm run e2e
git diff --check
git status --short
```

Expected: every command exits 0; CI records the exact toolchain, a valid dependency tree, tracked-secret boundaries, workspace checks, database/permission-loader integration, and browser smoke testing without deploying production resources.

- [ ] **Step 5: Commit with the specified message**

```bash
git add .github/workflows/platform-ci.yml tests/ci-workflow.test.mjs tests/security-boundaries.test.mjs
git commit -m "ci: verify platform foundation"
```

- [ ] **Step 6: Complete the Task gate**

Run requirements and code-quality reviews, resolve all Critical/Important findings, and rerun Step 4 before Task 10.

---

### Task 10: Document local development and architectural boundaries

**Files:**
- Modify: `.gitignore`
- Create: `docs/architecture/platform-foundation.md`
- Create: `docs/operations/local-development.md`
- Create: `tests/platform-docs.test.mjs`

**Interfaces:**
- Consumes: implemented workspace commands, ports, API contracts, Supabase schema, and R2 binding.
- Produces: operational documentation for Codex and future contributors.

- [ ] **Step 1: Write the failing documentation test**

Create `tests/platform-docs.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('platform documentation records the mandatory boundaries and commands', async () => {
  const [architecture, operations, gitignore] = await Promise.all([
    readFile(new URL('../docs/architecture/platform-foundation.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/operations/local-development.md', import.meta.url), 'utf8'),
    readFile(new URL('../.gitignore', import.meta.url), 'utf8'),
  ]);

  for (const statement of [
    'PostgreSQL is the only master data source',
    'R2 is the only master binary attachment source',
    'authorization is enforced by the API',
    'one Cloudflare Worker version',
    'cache-disabled Hyperdrive direct connection',
    'platform.access',
  ]) {
    assert.match(
      architecture,
      new RegExp(statement.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
    );
  }

  for (const command of [
    'npm ci --engine-strict --no-audit --no-fund',
    'npm ls --all',
    'npx supabase start',
    'npx supabase migration down --local --last 1 --yes',
    'npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql',
    'npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql',
    'npx supabase migration up --local',
    'npm run dev:api',
    'npm run dev:web',
    'node --test tests/security-boundaries.test.mjs',
    'node --test tests/worker-artifact.integration.mjs',
    'npm run test:db -w @wison/api',
    'npm run e2e:install',
    'npm run e2e',
  ]) {
    assert.match(operations, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }

  assert.match(gitignore, /^\.dev\.vars$/m);
  assert.match(gitignore, /^\.dev\.vars\.\*$/m);
});
```

- [ ] **Step 2: Run the documentation test and verify it fails**

Run:

```bash
node --test tests/platform-docs.test.mjs
```

Expected: FAIL because the documentation files do not exist.

- [ ] **Step 3: Write the architecture document**

Create `docs/architecture/platform-foundation.md` with these exact sections and decisions:

```markdown
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
```

- [ ] **Step 4: Write the local-development runbook**

Append these Cloudflare local-secret rules to `.gitignore` without removing existing entries:

```text
.dev.vars
.dev.vars.*
!.dev.vars.example
```

Create `docs/operations/local-development.md`:

```markdown
# Local Platform Development

## Prerequisites

- Node.js 22.23.2
- npm 10.9.8
- Docker compatible with the Supabase local stack
- No production Cloudflare, Supabase, R2, domain, or deployment credential is required for Foundation verification

## Install

```bash
node --version
npm --version
npm ci --engine-strict --no-audit --no-fund
```

The versions must be `v22.23.2` and `10.9.8`.

## Start local Supabase

```bash
npx supabase start
npx supabase db reset
```

## Configure API secrets

Create ignored `apps/api/.dev.vars` only when the local Supabase output requires values not already represented by the local Wrangler configuration:

```text
JWT_ALGORITHM=ES256
JWKS_CACHE_EPOCH=local-v1
SUPABASE_AUDIENCE=authenticated
SUPABASE_ISSUER=http://127.0.0.1:54321/auth/v1
```

Do not commit `.dev.vars`, database passwords, service-role keys, production tokens, or real Cloudflare binding IDs. Local PostgreSQL integration and local R2 emulation are selected through checked-in development configuration. The Foundation does not create a real local/production Hyperdrive binding or signing-key migration, so these values alone do not make the default `/api/v1/me` path a live identity integration; that environment evidence remains a later G3/G4 gate.

## Start applications

Integrated same-origin mode (used by smoke tests):

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

## Verify

```bash
npm ls --all
node --test tests/security-boundaries.test.mjs
npm run lint
npm run typecheck
npm test
npm run build
node --test tests/worker-artifact.integration.mjs
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase migration down --local --last 1 --yes
npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
npx supabase migration up --local
npx supabase test db
npm run test:db -w @wison/api
npm run e2e:install
npm run e2e
```

## Local ports

- Integrated Worker (Web + API): 8787
- Optional Vite hot reload: 4173
- Supabase API: 54321
- PostgreSQL: 54322
- Supabase Studio: 54323

## Secret handling

Never place database passwords, Supabase service-role credentials, Cloudflare API tokens, R2 access keys, or production user tokens in source files, browser environment variables, test snapshots, or logs. Foundation build and smoke commands are local/dry-run evidence only and do not prove Cloudflare production acceptance.
```

- [ ] **Step 5: Run the documentation and full foundation verification**

Run:

```bash
node --test tests/platform-docs.test.mjs
npm run lint
npm run typecheck
npm test
npm run build
node --test tests/worker-artifact.integration.mjs
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase migration down --local --last 1 --yes
npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
npx supabase migration up --local
npx supabase test db
npm run test:db -w @wison/api
npm run e2e:install
npm run e2e
git diff --check
git status --short
```

Expected: every command exits 0; no test is skipped.

- [ ] **Step 6: Commit with the specified message**

```bash
git add .gitignore docs/architecture/platform-foundation.md docs/operations/local-development.md tests/platform-docs.test.mjs
git commit -m "docs: document platform foundation"
```

- [ ] **Step 7: Complete the Task gate**

Run requirements and code-quality reviews, resolve all Critical/Important findings, and rerun Step 5. Task 10 completes this plan's local Foundation implementation scope only. Roadmap Plan 1 exit and G3 remain pending an actual successful CI run and the other evidence assigned to those gates; Task 10 does not authorize production deployment or any product-domain Task.

---

## 2. Final review gate

Before declaring the plan complete, run all commands from a clean checkout of the feature branch:

```bash
node --version
npm --version
npm ci --engine-strict --no-audit --no-fund
npm ls --all
node --test tests/security-boundaries.test.mjs
npm run lint
npm run typecheck
npm test
npm run build
node --test tests/worker-artifact.integration.mjs
npx supabase start
npx supabase db reset
npx supabase test db
npx supabase migration down --local --last 1 --yes
npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql
npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql
npx supabase migration up --local
npx supabase test db
npm run test:db -w @wison/api
npm run e2e:install
npm run e2e
```

Then verify the branch contains:

```bash
git log --oneline --decorate main..HEAD
git status --short
git diff main...HEAD --stat
```

Expected evidence:

1. `git status --short` is empty.
2. Node/npm are exactly `v22.23.2`/`10.9.8`, and every verification command exits 0.
3. The single Worker dry-run bundle is produced only after contracts declarations and Web assets.
4. SPA deep links, typed health, protected `/api/v1/me`, and unknown API JSON 404 behavior are verified.
5. The pgTAP suite passes every planned assertion before and after the unreleased additive baseline migration is rolled back one local version and reapplied, including fail-closed RLS/runtime-role tests and exact role/permission seed semantics.
6. The Playwright suite reports two passing Chromium engineering smoke tests; this does not claim G2 browser compatibility.
7. No existing static prototype, generated company page, map dataset, report dataset, or chart asset was deleted.
8. No secret, real production credential, production binding ID, or production deployment configuration is present in the diff.
9. Independent requirements and code-quality reviews have no unresolved Critical or Important findings for every Task.

## 3. Foundation acceptance criteria

The reviewer accepts a completed Foundation implementation under this plan only when:

- A clean checkout installs with Node.js `22.23.2`, npm `10.9.8`, and `npm ci --engine-strict`.
- All workspace types compile in strict mode.
- Shared contracts are the single source for health, user-context, and permission types.
- `/api/v1/health` is public and typed.
- `/api/v1/me` rejects unauthenticated and unauthorized requests.
- Supabase migrations create four security levels, four rights types, six roles, and exactly five Foundation permissions.
- Role-to-permission seeds reproduce only approved Foundation mappings; `super_admin` is not cross-joined to all permissions and no role is inferred by the shared schema.
- The API production path is wired for asymmetric project-JWKS verification, while local ES256/RS256 fixtures prove cryptographic validation; real project key rotation remains G3/G4 evidence.
- The API production path accepts a Hyperdrive binding and enforces `app_runtime` in a same-client fail-closed transaction; local PostgreSQL proves that path, while a real cache-disabled Hyperdrive resource remains G4 evidence.
- R2 access is behind `ObjectStorage`; no public file route is introduced.
- The React shell exposes exactly the three approved first-UAT navigation entries without implementing domain features; later top-level routes remain deferred to their product-domain plans.
- Unit, database, browser, dependency, and tracked-secret checks pass locally; the CI workflow definition is structurally tested, while an actual GitHub Actions run must be reported separately.
- Local development and architecture boundaries are documented.
- Web/API build output is one same-origin Worker artifact; no production deployment is performed or claimed.

## 4. Explicitly deferred to subsequent plans

The following work must not be added to this branch:

- Company schema, migration, API, or UI.
- Project schema, migration, API, map, or UI.
- Report schema, attachment routes, preview, extraction, or UI.
- Unified search implementation.
- Favorites, recent views, saved searches, subscriptions, notification records, or correction requests.
- Admin CRUD, staged imports, deduplication, review, publication, or data-quality dashboards.
- Production deployment credentials or domain configuration.
- Any production Cloudflare deployment, production Supabase migration, production R2 bucket creation, or production performance/SLA acceptance.
- Vector columns, embedding jobs, semantic retrieval, or AI answers.

These items are covered by the later plans listed in `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`.
