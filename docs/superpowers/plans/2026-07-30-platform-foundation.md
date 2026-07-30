# Oil & Gas Knowledge Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the production-oriented application foundation for the internal oil and gas knowledge platform: workspace, React shell, Cloudflare Workers API, shared contracts, Supabase governance schema, authentication boundary, private R2 adapter, automated tests, and CI.

**Architecture:** Add a new TypeScript workspace beside the current static prototypes without deleting or rewriting them. The React application consumes only versioned API contracts; the Hono Worker verifies Supabase JWTs, loads role permissions, and exposes protected endpoints. Supabase PostgreSQL stores identity/governance records, while an R2 binding provides private object storage behind an adapter.

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
- Node.js must be version 22.x.
- TypeScript strict mode must be enabled.
- Every task must use test-driven development and end with a commit.
- Do not begin company, project, report, search, ingestion, or AI feature implementation in this plan.

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
│       ├── package.json
│       ├── tsconfig.json
│       ├── vite.config.ts
│       ├── vitest.config.ts
│       └── wrangler.jsonc
├── packages/
│   └── contracts/
│       ├── src/
│       ├── test/
│       ├── package.json
│       ├── tsconfig.json
│       └── vitest.config.ts
├── supabase/
│   ├── migrations/
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
  | 'platform.read'
  | 'company.read'
  | 'project.read'
  | 'report.read'
  | 'file.download'
  | 'favorite.manage'
  | 'subscription.manage'
  | 'correction.create'
  | 'admin.access'
  | 'admin.content.manage'
  | 'admin.review'
  | 'admin.user.manage'
  | 'audit.read';

export interface HealthResponse {
  status: 'ok';
  service: 'api';
  version: string;
  timestamp: string;
}

export interface UserContext {
  userId: string;
  email: string;
  roles: string[];
  permissions: Permission[];
}

// apps/api/src/auth/types.ts
export interface VerifiedIdentity {
  userId: string;
  email: string;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}

export interface PermissionLoader {
  load(token: string, identity: VerifiedIdentity): Promise<UserContext>;
}

// apps/api/src/storage/object-storage.ts
export interface ObjectStorage {
  put(key: string, body: ReadableStream | ArrayBuffer | string, metadata: ObjectMetadata): Promise<void>;
  head(key: string): Promise<StoredObjectMetadata | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}
```

---

### Task 1: Bootstrap the npm workspace

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

- [ ] **Step 1: Write the failing workspace-layout test**

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

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
node --test tests/workspace-layout.test.mjs
```

Expected: FAIL because `package.json` and workspace manifests do not exist.

- [ ] **Step 3: Create the root workspace files**

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
playwright-report/
test-results/
.wrangler/
.supabase/
```

- [ ] **Step 4: Create the three workspace manifests**

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

- [ ] **Step 5: Install the exact dependency groups and create the lockfile**

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

- [ ] **Step 6: Run the workspace-layout test and verify it passes**

Run:

```bash
node --test tests/workspace-layout.test.mjs
```

Expected: PASS, 2 tests.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json .nvmrc tsconfig.base.json .gitignore apps/web/package.json apps/api/package.json packages/contracts/package.json tests/workspace-layout.test.mjs
git commit -m "build: bootstrap platform workspaces"
```

---

### Task 2: Define shared API and authorization contracts

**Files:**
- Create: `packages/contracts/tsconfig.json`
- Create: `packages/contracts/tsconfig.build.json`
- Create: `packages/contracts/vitest.config.ts`
- Create: `packages/contracts/src/api.ts`
- Create: `packages/contracts/src/auth.ts`
- Create: `packages/contracts/src/index.ts`
- Create: `packages/contracts/test/contracts.test.ts`

**Interfaces:**
- Consumes: Zod and TypeScript workspace created in Task 1.
- Produces: `HealthResponseSchema`, `ApiErrorResponseSchema`, `PermissionSchema`, `UserContextSchema`, and their inferred TypeScript types.

- [ ] **Step 1: Write the failing contract tests**

Create `packages/contracts/test/contracts.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  PermissionSchema,
  UserContextSchema,
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
});

describe('UserContextSchema', () => {
  it('rejects permissions outside the published permission vocabulary', () => {
    expect(() =>
      UserContextSchema.parse({
        userId: '7c786f9f-704f-4df0-b766-2199284ca34d',
        email: 'sales@example.com',
        roles: ['sales_bd'],
        permissions: ['database.drop'],
      }),
    ).toThrow();
  });

  it('accepts a valid sales user context', () => {
    const parsed = UserContextSchema.parse({
      userId: '7c786f9f-704f-4df0-b766-2199284ca34d',
      email: 'sales@example.com',
      roles: ['sales_bd'],
      permissions: ['platform.read', 'company.read', 'project.read', 'report.read'],
    });

    expect(PermissionSchema.parse(parsed.permissions[0])).toBe('platform.read');
  });
});

describe('ApiErrorResponseSchema', () => {
  it('requires a stable request id', () => {
    const parsed = ApiErrorResponseSchema.parse({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication is required.',
        requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
      },
    });

    expect(parsed.error.code).toBe('UNAUTHORIZED');
  });
});
```

- [ ] **Step 2: Run the contract tests and verify they fail**

Run:

```bash
npm run test -w @wison/contracts
```

Expected: FAIL because the contract source files do not exist.

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
    coverage: {
      reporter: ['text', 'json-summary'],
    },
  },
});
```

- [ ] **Step 4: Implement the API contracts**

Create `packages/contracts/src/api.ts`:

```ts
import { z } from 'zod';

export const HealthResponseSchema = z.object({
  status: z.literal('ok'),
  service: z.literal('api'),
  version: z.string().min(1),
  timestamp: z.string().datetime(),
});

export type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string().min(1),
    message: z.string().min(1),
    requestId: z.string().min(1),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
```

Create `packages/contracts/src/auth.ts`:

```ts
import { z } from 'zod';

export const permissionValues = [
  'platform.read',
  'company.read',
  'project.read',
  'report.read',
  'file.download',
  'favorite.manage',
  'subscription.manage',
  'correction.create',
  'admin.access',
  'admin.content.manage',
  'admin.review',
  'admin.user.manage',
  'audit.read',
] as const;

export const PermissionSchema = z.enum(permissionValues);
export type Permission = z.infer<typeof PermissionSchema>;

export const UserContextSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  roles: z.array(z.string().min(1)),
  permissions: z.array(PermissionSchema),
});

export type UserContext = z.infer<typeof UserContextSchema>;
```

Create `packages/contracts/src/index.ts`:

```ts
export * from './api';
export * from './auth';
```

- [ ] **Step 5: Run tests, type checking, and build**

Run:

```bash
npm run test -w @wison/contracts
npm run typecheck -w @wison/contracts
npm run build -w @wison/contracts
```

Expected: all commands exit 0; contract tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts
git commit -m "feat: define shared platform contracts"
```

---

### Task 3: Create the Cloudflare Workers API shell

**Files:**
- Create: `apps/api/tsconfig.json`
- Create: `apps/api/vitest.config.ts`
- Create: `apps/api/wrangler.jsonc`
- Create: `apps/api/src/types.ts`
- Create: `apps/api/src/lib/app-error.ts`
- Create: `apps/api/src/middleware/request-id.ts`
- Create: `apps/api/src/routes/health.ts`
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/index.ts`
- Create: `apps/api/test/health.test.ts`

**Interfaces:**
- Consumes: `HealthResponse` and `ApiErrorResponse` from `@wison/contracts`.
- Produces: public `GET /api/v1/health`; `createApp()` for tests and later route composition; `AppBindings` and `AppVariables` types.

- [ ] **Step 1: Write the failing health-route tests**

Create `apps/api/test/health.test.ts`:

```ts
import { ApiErrorResponseSchema, HealthResponseSchema } from '@wison/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/v1/health', () => {
  it('returns the typed health response and a request id', async () => {
    const response = await createApp().request('/api/v1/health');
    const body = HealthResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get('x-request-id')).toMatch(/^req_/);
    expect(body).toMatchObject({ status: 'ok', service: 'api', version: '0.1.0' });
  });

  it('returns the stable error envelope for an unknown API route', async () => {
    const response = await createApp().request('/api/v1/not-a-route');
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
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

Create `apps/api/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wison-knowledge-api",
  "main": "src/index.ts",
  "compatibility_date": "2026-07-30",
  "compatibility_flags": ["nodejs_compat"],
  "vars": {
    "APP_VERSION": "0.1.0",
    "ALLOWED_ORIGIN": "http://127.0.0.1:4173"
  },
  "r2_buckets": [
    {
      "binding": "FILES",
      "bucket_name": "wison-knowledge-files-dev",
      "preview_bucket_name": "wison-knowledge-files-dev"
    }
  ]
}
```

Create `apps/api/src/types.ts`:

```ts
import type { UserContext } from '@wison/contracts';

export interface AppBindings {
  ALLOWED_ORIGIN: string;
  APP_VERSION: string;
  FILES: R2Bucket;
  SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_URL: string;
}

export interface AppVariables {
  accessToken: string;
  requestId: string;
  user: UserContext;
}

export type AppEnvironment = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
```

- [ ] **Step 4: Implement request IDs, errors, and health route**

Create `apps/api/src/lib/app-error.ts`:

```ts
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}
```

Create `apps/api/src/middleware/request-id.ts`:

```ts
import { createMiddleware } from 'hono/factory';
import type { AppEnvironment } from '../types';

export const requestIdMiddleware = createMiddleware<AppEnvironment>(async (context, next) => {
  const inbound = context.req.header('x-request-id');
  const requestId = inbound?.startsWith('req_') ? inbound : `req_${crypto.randomUUID()}`;

  context.set('requestId', requestId);
  await next();
  context.header('x-request-id', requestId);
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
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { AppError } from './lib/app-error';
import { requestIdMiddleware } from './middleware/request-id';
import { healthRoutes } from './routes/health';
import type { AppEnvironment } from './types';

export function createApp(): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());
  app.use(
    '*',
    cors({
      origin: (origin, context) => {
        const allowed = context.env?.ALLOWED_ORIGIN ?? 'http://127.0.0.1:4173';
        return origin === allowed ? origin : allowed;
      },
      credentials: true,
    }),
  );

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
npm run build -w @wison/api
```

Expected: all commands exit 0; both health tests pass; Wrangler produces a dry-run bundle.

- [ ] **Step 6: Commit**

```bash
git add apps/api
git commit -m "feat: add typed Workers API shell"
```

---

### Task 4: Create the React application shell

**Files:**
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/wrangler.jsonc`
- Create: `apps/web/index.html`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/lib/api-client.ts`
- Create: `apps/web/src/components/health-badge.tsx`
- Create: `apps/web/src/app-router.tsx`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/test/app-shell.test.tsx`

**Interfaces:**
- Consumes: public `GET /api/v1/health` and `HealthResponseSchema`.
- Produces: stable top-level routes `/`, `/companies`, `/projects`, `/reports`, `/search`, `/watchlist`, `/notifications`, and `/admin`; `getApiHealth()` client.

- [ ] **Step 1: Write the failing application-shell test**

Create `apps/web/src/test/app-shell.test.tsx`:

```tsx
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createMemoryHistory } from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
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
    expect(screen.getByRole('link', { name: '公司' })).toHaveAttribute('href', '/companies');
    expect(screen.getByRole('link', { name: '项目' })).toHaveAttribute('href', '/projects');
    expect(screen.getByRole('link', { name: '报告' })).toHaveAttribute('href', '/reports');
    expect(await screen.findByText('API 正常')).toBeInTheDocument();
  });
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Run the web test and verify it fails**

Run:

```bash
npm run test -w @wison/web
```

Expected: FAIL because `app-router.tsx` does not exist.

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

Create `apps/web/wrangler.jsonc`:

```jsonc
{
  "$schema": "../../node_modules/wrangler/config-schema.json",
  "name": "wison-knowledge-web",
  "compatibility_date": "2026-07-30",
  "assets": {
    "directory": "./dist",
    "not_found_handling": "single-page-application"
  }
}
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

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? '';

export async function getApiHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch(`${apiBaseUrl}/api/v1/health`, {
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
  ['/companies', '公司'],
  ['/projects', '项目'],
  ['/reports', '报告'],
  ['/search', '搜索'],
  ['/watchlist', '关注'],
  ['/notifications', '提醒'],
  ['/admin', '管理'],
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
  );
}

function HomePage() {
  return (
    <section>
      <h2>内部油气行业知识入口</h2>
      <p>公司、项目和行业报告模块将在后续独立计划中接入正式数据。</p>
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

const rootRoute = createRootRoute({ component: AppShell });
const indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HomePage });
const companiesRoute = createRoute({ getParentRoute: () => rootRoute, path: '/companies', component: () => <SectionPage title="公司信息库" /> });
const projectsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/projects', component: () => <SectionPage title="项目数据库" /> });
const reportsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/reports', component: () => <SectionPage title="行业报告库" /> });
const searchRoute = createRoute({ getParentRoute: () => rootRoute, path: '/search', component: () => <SectionPage title="统一搜索" /> });
const watchlistRoute = createRoute({ getParentRoute: () => rootRoute, path: '/watchlist', component: () => <SectionPage title="关注清单" /> });
const notificationsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/notifications', component: () => <SectionPage title="更新提醒" /> });
const adminRoute = createRoute({ getParentRoute: () => rootRoute, path: '/admin', component: () => <SectionPage title="管理后台" /> });

const routeTree = rootRoute.addChildren([
  indexRoute,
  companiesRoute,
  projectsRoute,
  reportsRoute,
  searchRoute,
  watchlistRoute,
  notificationsRoute,
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
  font-family: Inter, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  color: #172033;
  background: #f4f6f9;
  font-synthesis: none;
}

* { box-sizing: border-box; }
body { margin: 0; min-width: 320px; min-height: 100vh; }
a { color: inherit; }

.app-shell { min-height: 100vh; }
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
.primary-nav { display: flex; gap: 8px; padding: 12px 32px; background: #ffffff; border-bottom: 1px solid #dfe4ec; overflow-x: auto; }
.primary-nav a { padding: 8px 12px; border-radius: 8px; text-decoration: none; white-space: nowrap; }
.primary-nav a[aria-current="page"] { background: #e8edf5; font-weight: 600; }
.page-content { padding: 32px; }
.health { padding: 6px 10px; border-radius: 999px; font-size: 13px; }
.health--ok { background: #e5f5ea; color: #176b36; }
.health--loading { background: #eef1f5; color: #4e5b6d; }
.health--error { background: #fdeaea; color: #9d2020; }
```

- [ ] **Step 6: Run web tests, type checking, and build**

Run:

```bash
npm run test -w @wison/web
npm run typecheck -w @wison/web
npm run build -w @wison/web
```

Expected: all commands exit 0; application-shell test passes; `apps/web/dist/` is created.

- [ ] **Step 7: Commit**

```bash
git add apps/web package.json package-lock.json
git commit -m "feat: add React platform shell"
```

---

### Task 5: Create the Supabase governance and role schema

**Files:**
- Create: `supabase/config.toml`
- Create: `supabase/migrations/202607300001_platform_foundation.sql`
- Create: `supabase/tests/platform_foundation_test.sql`

**Interfaces:**
- Consumes: Permission vocabulary from `@wison/contracts`.
- Produces: `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `security_levels`, `rights_types`, `audit_events`, and RPC `get_current_user_context()`.

- [ ] **Step 1: Initialize Supabase and remove generated example migrations**

Run:

```bash
npx supabase init
```

Keep the generated `supabase/config.toml`. Remove only generated sample migration files if the CLI created any; do not remove the config.

Set these exact project identifiers in `supabase/config.toml`:

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

- [ ] **Step 2: Write the failing pgTAP test**

Create `supabase/tests/platform_foundation_test.sql`:

```sql
begin;
select plan(14);

select has_table('public', 'user_profiles');
select has_table('public', 'roles');
select has_table('public', 'permissions');
select has_table('public', 'role_permissions');
select has_table('public', 'user_roles');
select has_table('public', 'security_levels');
select has_table('public', 'rights_types');
select has_table('public', 'audit_events');
select has_function('public', 'get_current_user_context', array[]::text[]);
select results_eq('select count(*)::bigint from public.security_levels', array[4::bigint]);
select results_eq('select count(*)::bigint from public.rights_types', array[4::bigint]);
select results_eq('select count(*)::bigint from public.permissions', array[13::bigint]);
select results_eq('select count(*)::bigint from public.roles', array[6::bigint]);
select ok(
  (select relrowsecurity from pg_class where oid = 'public.audit_events'::regclass),
  'audit_events has row level security enabled'
);

select * from finish();
rollback;
```

- [ ] **Step 3: Start the local Supabase stack and verify the test fails**

Run:

```bash
npx supabase start
npx supabase test db
```

Expected: FAIL because the platform tables and function do not exist.

- [ ] **Step 4: Implement the platform foundation migration**

Create `supabase/migrations/202607300001_platform_foundation.sql`:

```sql
create extension if not exists pgcrypto with schema extensions;

create table public.security_levels (
  code text primary key,
  rank smallint not null unique check (rank between 1 and 4),
  name_zh text not null,
  description text not null
);

insert into public.security_levels (code, rank, name_zh, description) values
  ('L1', 1, '公开信息', 'Public information approved for broad internal use.'),
  ('L2', 2, '内部一般信息', 'General internal information.'),
  ('L3', 3, '订阅授权数据', 'Licensed subscription information restricted by role or user.'),
  ('L4', 4, '敏感分析资料', 'Sensitive analysis or management information requiring explicit access.');

create table public.rights_types (
  code text primary key,
  name_zh text not null,
  description text not null
);

insert into public.rights_types (code, name_zh, description) values
  ('OWNED', '自有原创', 'Content created and owned by Wison or the platform team.'),
  ('PUBLIC_THIRD_PARTY', '公开第三方', 'Publicly accessible content owned by an external party.'),
  ('LICENSED_RESTRICTED', '订阅授权受限', 'Licensed content restricted by subscription terms.'),
  ('DERIVED_REVIEW_REQUIRED', '衍生内容待审核', 'Derived content requiring rights and disclosure review.');

create table public.user_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  department text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  name_zh text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.permissions (
  code text primary key,
  description text not null
);

create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete cascade,
  permission_code text not null references public.permissions(code) on delete cascade,
  primary key (role_id, permission_code)
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_id uuid not null references public.roles(id) on delete cascade,
  assigned_by uuid references auth.users(id) on delete set null,
  assigned_at timestamptz not null default now(),
  primary key (user_id, role_id)
);

create table public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  actor_user_id uuid references auth.users(id) on delete set null,
  request_id text,
  action text not null,
  subject_type text not null,
  subject_id text,
  security_level_code text references public.security_levels(code),
  metadata jsonb not null default '{}'::jsonb
);

create index audit_events_actor_occurred_idx on public.audit_events (actor_user_id, occurred_at desc);
create index audit_events_subject_idx on public.audit_events (subject_type, subject_id, occurred_at desc);

insert into public.permissions (code, description) values
  ('platform.read', 'Access the authenticated platform shell.'),
  ('company.read', 'Read authorized company records.'),
  ('project.read', 'Read authorized project records.'),
  ('report.read', 'Read authorized report metadata and text.'),
  ('file.download', 'Preview or download authorized files.'),
  ('favorite.manage', 'Create and delete personal favorites.'),
  ('subscription.manage', 'Create and delete personal subscriptions.'),
  ('correction.create', 'Submit correction requests.'),
  ('admin.access', 'Access the administrative application.'),
  ('admin.content.manage', 'Create and edit governed content.'),
  ('admin.review', 'Approve or reject governed content changes.'),
  ('admin.user.manage', 'Manage users and role assignments.'),
  ('audit.read', 'Read audit and operational events.');

insert into public.roles (code, name_zh, description) values
  ('super_admin', '超级管理员', 'Full platform and user administration.'),
  ('research_admin', '市场研究管理员', 'Governed content, review, quality, and audit administration.'),
  ('content_editor', '内容编辑', 'Create and edit draft content.'),
  ('content_reviewer', '内容审核员', 'Review and approve governed changes.'),
  ('sales_bd', '销售与商务用户', 'Search, read, follow, export, and submit corrections.'),
  ('management_readonly', '管理层只读用户', 'Read authorized intelligence and exports.');

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r
cross join public.permissions p
where r.code = 'super_admin';

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on p.code in (
  'platform.read', 'company.read', 'project.read', 'report.read', 'file.download',
  'favorite.manage', 'subscription.manage', 'correction.create', 'admin.access',
  'admin.content.manage', 'admin.review', 'audit.read'
)
where r.code = 'research_admin';

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on p.code in (
  'platform.read', 'company.read', 'project.read', 'report.read', 'file.download',
  'admin.access', 'admin.content.manage'
)
where r.code = 'content_editor';

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on p.code in (
  'platform.read', 'company.read', 'project.read', 'report.read', 'file.download',
  'admin.access', 'admin.review'
)
where r.code = 'content_reviewer';

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on p.code in (
  'platform.read', 'company.read', 'project.read', 'report.read', 'file.download',
  'favorite.manage', 'subscription.manage', 'correction.create'
)
where r.code = 'sales_bd';

insert into public.role_permissions (role_id, permission_code)
select r.id, p.code
from public.roles r
join public.permissions p on p.code in (
  'platform.read', 'company.read', 'project.read', 'report.read', 'file.download'
)
where r.code = 'management_readonly';

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id, email, display_name)
  values (
    new.id,
    coalesce(new.email, new.id::text || '@invalid.local'),
    nullif(new.raw_user_meta_data ->> 'display_name', '')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

create or replace function public.get_current_user_context()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'userId', u.id,
    'email', u.email,
    'roles', coalesce(
      (
        select jsonb_agg(distinct r.code order by r.code)
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = u.id
      ),
      '[]'::jsonb
    ),
    'permissions', coalesce(
      (
        select jsonb_agg(distinct rp.permission_code order by rp.permission_code)
        from public.user_roles ur
        join public.role_permissions rp on rp.role_id = ur.role_id
        where ur.user_id = u.id
      ),
      '[]'::jsonb
    )
  )
  from auth.users u
  join public.user_profiles profile on profile.user_id = u.id and profile.is_active
  where u.id = auth.uid();
$$;

revoke all on function public.get_current_user_context() from public;
grant execute on function public.get_current_user_context() to authenticated;

alter table public.user_profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.security_levels enable row level security;
alter table public.rights_types enable row level security;
alter table public.audit_events enable row level security;

create policy user_profiles_select_self
on public.user_profiles
for select
to authenticated
using (user_id = auth.uid());

create policy user_profiles_update_self
on public.user_profiles
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

- [ ] **Step 5: Reset the database and run the pgTAP test**

Run:

```bash
npx supabase db reset
npx supabase test db
```

Expected: PASS, 14 pgTAP assertions.

- [ ] **Step 6: Commit**

```bash
git add supabase
git commit -m "feat: add governance and role schema"
```

---

### Task 6: Add Supabase JWT verification and permission middleware

**Files:**
- Create: `apps/api/src/auth/types.ts`
- Create: `apps/api/src/auth/supabase-jwt-verifier.ts`
- Create: `apps/api/src/auth/supabase-permission-loader.ts`
- Create: `apps/api/src/middleware/authenticate.ts`
- Create: `apps/api/src/middleware/require-permission.ts`
- Create: `apps/api/src/routes/me.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/test/auth.test.ts`

**Interfaces:**
- Consumes: Supabase JWKS endpoint, RPC `get_current_user_context()`, `UserContextSchema`, `Permission`.
- Produces: `TokenVerifier`, `PermissionLoader`, `authenticate()`, `requirePermission()`, and protected `GET /api/v1/me`.

- [ ] **Step 1: Write failing authentication and permission tests**

Create `apps/api/test/auth.test.ts`:

```ts
import type { UserContext } from '@wison/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import type { AuthServicesFactory, PermissionLoader, TokenVerifier } from '../src/auth/types';

const identity = {
  userId: '7c786f9f-704f-4df0-b766-2199284ca34d',
  email: 'sales@example.com',
};

function factoryFor(user: UserContext): AuthServicesFactory {
  return () => ({
    tokenVerifier: {
      verify: async () => identity,
    } satisfies TokenVerifier,
    permissionLoader: {
      load: async () => user,
    } satisfies PermissionLoader,
  });
}

describe('GET /api/v1/me', () => {
  it('rejects requests without a bearer token', async () => {
    const app = createApp(factoryFor({ ...identity, roles: ['sales_bd'], permissions: ['platform.read'] }));
    const response = await app.request('/api/v1/me');

    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({ error: { code: 'UNAUTHORIZED' } });
  });

  it('rejects an authenticated user without platform.read', async () => {
    const app = createApp(factoryFor({ ...identity, roles: [], permissions: [] }));
    const response = await app.request('/api/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({ error: { code: 'FORBIDDEN' } });
  });

  it('returns the authorized user context', async () => {
    const user = { ...identity, roles: ['sales_bd'], permissions: ['platform.read'] as const };
    const app = createApp(factoryFor(user));
    const response = await app.request('/api/v1/me', {
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(user);
  });
});
```

- [ ] **Step 2: Run the auth tests and verify they fail**

Run:

```bash
npm run test -w @wison/api -- auth.test.ts
```

Expected: FAIL because auth types and middleware do not exist.

- [ ] **Step 3: Define auth interfaces and Supabase adapters**

Create `apps/api/src/auth/types.ts`:

```ts
import type { UserContext } from '@wison/contracts';
import type { AppBindings } from '../types';

export interface VerifiedIdentity {
  userId: string;
  email: string;
}

export interface TokenVerifier {
  verify(token: string): Promise<VerifiedIdentity>;
}

export interface PermissionLoader {
  load(token: string, identity: VerifiedIdentity): Promise<UserContext>;
}

export interface AuthServices {
  tokenVerifier: TokenVerifier;
  permissionLoader: PermissionLoader;
}

export type AuthServicesFactory = (bindings: AppBindings) => AuthServices;
```

Create `apps/api/src/auth/supabase-jwt-verifier.ts`:

```ts
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { AppError } from '../lib/app-error';
import type { TokenVerifier, VerifiedIdentity } from './types';

export class SupabaseJwtVerifier implements TokenVerifier {
  private readonly jwks;

  constructor(private readonly supabaseUrl: string) {
    this.jwks = createRemoteJWKSet(
      new URL(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/.well-known/jwks.json`),
    );
  }

  async verify(token: string): Promise<VerifiedIdentity> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${this.supabaseUrl.replace(/\/$/, '')}/auth/v1`,
      });

      if (typeof payload.sub !== 'string' || typeof payload.email !== 'string') {
        throw new Error('Required Supabase claims are missing.');
      }

      return { userId: payload.sub, email: payload.email };
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'The access token is invalid or expired.');
    }
  }
}
```

Create `apps/api/src/auth/supabase-permission-loader.ts`:

```ts
import { UserContextSchema, type UserContext } from '@wison/contracts';
import { createClient } from '@supabase/supabase-js';
import { AppError } from '../lib/app-error';
import type { PermissionLoader, VerifiedIdentity } from './types';

export class SupabasePermissionLoader implements PermissionLoader {
  constructor(
    private readonly supabaseUrl: string,
    private readonly publishableKey: string,
  ) {}

  async load(token: string, identity: VerifiedIdentity): Promise<UserContext> {
    const client = createClient(this.supabaseUrl, this.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data, error } = await client.rpc('get_current_user_context');
    if (error || !data) {
      throw new AppError('FORBIDDEN', 403, 'The user is inactive or has no platform access.');
    }

    const parsed = UserContextSchema.parse(data);
    if (parsed.userId !== identity.userId || parsed.email !== identity.email) {
      throw new AppError('UNAUTHORIZED', 401, 'The authorization context does not match the token.');
    }

    return parsed;
  }
}
```

- [ ] **Step 4: Implement authentication and authorization middleware**

Create `apps/api/src/middleware/authenticate.ts`:

```ts
import { createMiddleware } from 'hono/factory';
import type { AuthServicesFactory } from '../auth/types';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

export function authenticate(createServices: AuthServicesFactory) {
  return createMiddleware<AppEnvironment>(async (context, next) => {
    const authorization = context.req.header('authorization');
    if (!authorization?.startsWith('Bearer ')) {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication is required.');
    }

    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new AppError('UNAUTHORIZED', 401, 'Authentication is required.');

    const services = createServices(context.env);
    const identity = await services.tokenVerifier.verify(token);
    const user = await services.permissionLoader.load(token, identity);

    context.set('accessToken', token);
    context.set('user', user);
    await next();
  });
}
```

Create `apps/api/src/middleware/require-permission.ts`:

```ts
import type { Permission } from '@wison/contracts';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

export function requirePermission(permission: Permission) {
  return createMiddleware<AppEnvironment>(async (context, next) => {
    const user = context.get('user');
    if (!user.permissions.includes(permission)) {
      throw new AppError('FORBIDDEN', 403, `Permission ${permission} is required.`);
    }
    await next();
  });
}
```

Create `apps/api/src/routes/me.ts`:

```ts
import { Hono } from 'hono';
import type { AppEnvironment } from '../types';

export const meRoutes = new Hono<AppEnvironment>().get('/', (context) => {
  return context.json(context.get('user'), 200);
});
```

- [ ] **Step 5: Wire protected routes into the API**

Modify `apps/api/src/app.ts` so `createApp` accepts an auth factory and mounts the route:

```ts
import { SupabaseJwtVerifier } from './auth/supabase-jwt-verifier';
import { SupabasePermissionLoader } from './auth/supabase-permission-loader';
import type { AuthServicesFactory } from './auth/types';
import { authenticate } from './middleware/authenticate';
import { requirePermission } from './middleware/require-permission';
import { meRoutes } from './routes/me';

const defaultAuthServicesFactory: AuthServicesFactory = (bindings) => ({
  tokenVerifier: new SupabaseJwtVerifier(bindings.SUPABASE_URL),
  permissionLoader: new SupabasePermissionLoader(
    bindings.SUPABASE_URL,
    bindings.SUPABASE_PUBLISHABLE_KEY,
  ),
});

export function createApp(
  authServicesFactory: AuthServicesFactory = defaultAuthServicesFactory,
): Hono<AppEnvironment> {
  // Keep the request-id, secure-header, CORS, health, not-found, and error handlers from Task 3.
  // Add these lines after the public health route:
  app.use('/api/v1/me/*', authenticate(authServicesFactory));
  app.use('/api/v1/me/*', requirePermission('platform.read'));
  app.route('/api/v1/me', meRoutes);
  return app;
}
```

When editing, retain the complete Task 3 implementation; do not duplicate `createApp` or remove the existing handlers.

- [ ] **Step 6: Run authentication tests and the complete API suite**

Run:

```bash
npm run test -w @wison/api
npm run typecheck -w @wison/api
npm run build -w @wison/api
```

Expected: all commands exit 0; unauthorized, forbidden, and authorized cases pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api
git commit -m "feat: enforce Supabase authentication and permissions"
```

---

### Task 7: Add the private R2 object-storage adapter

**Files:**
- Create: `apps/api/src/storage/object-storage.ts`
- Create: `apps/api/src/storage/r2-object-storage.ts`
- Create: `apps/api/test/r2-object-storage.test.ts`

**Interfaces:**
- Consumes: `FILES: R2Bucket` binding from `AppBindings`.
- Produces: `ObjectStorage`, `ObjectMetadata`, `StoredObjectMetadata`, and `R2ObjectStorage` for the report/document plan.

- [ ] **Step 1: Write the failing R2 adapter test**

Create `apps/api/test/r2-object-storage.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { R2ObjectStorage } from '../src/storage/r2-object-storage';

function createBucketStub() {
  return {
    put: vi.fn().mockResolvedValue({}),
    head: vi.fn().mockResolvedValue({
      key: 'reports/report-1/file.pdf',
      size: 2048,
      etag: 'etag-1',
      uploaded: new Date('2026-07-30T12:00:00.000Z'),
      httpMetadata: { contentType: 'application/pdf' },
      customMetadata: { securityLevel: 'L3', rightsType: 'LICENSED_RESTRICTED' },
    }),
    get: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(undefined),
  };
}

describe('R2ObjectStorage', () => {
  it('writes governance metadata with the object', async () => {
    const bucket = createBucketStub();
    const storage = new R2ObjectStorage(bucket as unknown as R2Bucket);

    await storage.put('reports/report-1/file.pdf', 'pdf-body', {
      contentType: 'application/pdf',
      securityLevel: 'L3',
      rightsType: 'LICENSED_RESTRICTED',
      checksum: 'sha256:abc123',
    });

    expect(bucket.put).toHaveBeenCalledWith(
      'reports/report-1/file.pdf',
      'pdf-body',
      expect.objectContaining({
        httpMetadata: { contentType: 'application/pdf' },
        customMetadata: expect.objectContaining({ securityLevel: 'L3' }),
      }),
    );
  });

  it('normalizes R2 head metadata', async () => {
    const storage = new R2ObjectStorage(createBucketStub() as unknown as R2Bucket);
    const result = await storage.head('reports/report-1/file.pdf');

    expect(result).toMatchObject({
      key: 'reports/report-1/file.pdf',
      size: 2048,
      contentType: 'application/pdf',
      securityLevel: 'L3',
      rightsType: 'LICENSED_RESTRICTED',
    });
  });
});
```

- [ ] **Step 2: Run the R2 adapter test and verify it fails**

Run:

```bash
npm run test -w @wison/api -- r2-object-storage.test.ts
```

Expected: FAIL because the storage adapter does not exist.

- [ ] **Step 3: Define the storage contract**

Create `apps/api/src/storage/object-storage.ts`:

```ts
export interface ObjectMetadata {
  checksum: string;
  contentType: string;
  rightsType: 'OWNED' | 'PUBLIC_THIRD_PARTY' | 'LICENSED_RESTRICTED' | 'DERIVED_REVIEW_REQUIRED';
  securityLevel: 'L1' | 'L2' | 'L3' | 'L4';
}

export interface StoredObjectMetadata extends ObjectMetadata {
  etag: string;
  key: string;
  size: number;
  uploadedAt: string;
}

export interface ObjectStorage {
  put(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    metadata: ObjectMetadata,
  ): Promise<void>;
  head(key: string): Promise<StoredObjectMetadata | null>;
  get(key: string): Promise<R2ObjectBody | null>;
  delete(key: string): Promise<void>;
}
```

- [ ] **Step 4: Implement the R2 adapter**

Create `apps/api/src/storage/r2-object-storage.ts`:

```ts
import type { ObjectMetadata, ObjectStorage, StoredObjectMetadata } from './object-storage';

export class R2ObjectStorage implements ObjectStorage {
  constructor(private readonly bucket: R2Bucket) {}

  async put(
    key: string,
    body: ReadableStream | ArrayBuffer | string,
    metadata: ObjectMetadata,
  ): Promise<void> {
    await this.bucket.put(key, body, {
      httpMetadata: { contentType: metadata.contentType },
      customMetadata: {
        checksum: metadata.checksum,
        rightsType: metadata.rightsType,
        securityLevel: metadata.securityLevel,
      },
    });
  }

  async head(key: string): Promise<StoredObjectMetadata | null> {
    const object = await this.bucket.head(key);
    if (!object) return null;

    return {
      key: object.key,
      size: object.size,
      etag: object.etag,
      uploadedAt: object.uploaded.toISOString(),
      contentType: object.httpMetadata?.contentType ?? 'application/octet-stream',
      checksum: object.customMetadata?.checksum ?? '',
      rightsType: (object.customMetadata?.rightsType ?? 'DERIVED_REVIEW_REQUIRED') as StoredObjectMetadata['rightsType'],
      securityLevel: (object.customMetadata?.securityLevel ?? 'L4') as StoredObjectMetadata['securityLevel'],
    };
  }

  get(key: string): Promise<R2ObjectBody | null> {
    return this.bucket.get(key);
  }

  async delete(key: string): Promise<void> {
    await this.bucket.delete(key);
  }
}
```

- [ ] **Step 5: Run API tests, type checking, and build**

Run:

```bash
npm run test -w @wison/api
npm run typecheck -w @wison/api
npm run build -w @wison/api
```

Expected: all commands exit 0; R2 metadata tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/storage apps/api/test/r2-object-storage.test.ts
git commit -m "feat: add private R2 storage adapter"
```

---

### Task 8: Add browser smoke tests

**Files:**
- Create: `apps/web/.env.test`
- Create: `playwright.config.ts`
- Create: `e2e/platform-shell.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: local API on port 8787 and local web application on port 4173.
- Produces: a repeatable browser-level verification of the shell and public health integration.

- [ ] **Step 1: Write the failing Playwright smoke test**

Create `e2e/platform-shell.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('loads the platform shell and receives API health', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: '市场知识平台' })).toBeVisible();
  await expect(page.getByRole('link', { name: '公司' })).toBeVisible();
  await expect(page.getByRole('link', { name: '项目' })).toBeVisible();
  await expect(page.getByRole('link', { name: '报告' })).toBeVisible();
  await expect(page.getByText('API 正常')).toBeVisible();
});
```

- [ ] **Step 2: Add test environment and Playwright configuration**

Create `apps/web/.env.test`:

```text
VITE_API_BASE_URL=http://127.0.0.1:8787
```

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w @wison/api -- --port 8787',
      port: 8787,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -w @wison/web -- --mode test --host 127.0.0.1 --port 4173',
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
```

Add this root script to `package.json`:

```json
"e2e:install": "playwright install chromium"
```

- [ ] **Step 3: Install Chromium and run the smoke test**

Run:

```bash
npm run e2e:install
npm run e2e
```

Expected: PASS, 1 Chromium test. If the API reports an R2 local-binding warning, the health endpoint must still return 200.

- [ ] **Step 4: Run all workspace verification commands**

Run:

```bash
npm run typecheck
npm test
npm run build
npm run e2e
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/web/.env.test playwright.config.ts e2e package.json package-lock.json
git commit -m "test: add platform browser smoke test"
```

---

### Task 9: Add continuous integration

**Files:**
- Create: `.github/workflows/platform-ci.yml`
- Create: `tests/ci-workflow.test.mjs`

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
    'npm ci',
    'npm run typecheck',
    'npm test',
    'npm run build',
    'npx supabase db reset',
    'npx supabase test db',
    'npm run e2e',
  ]) {
    assert.match(workflow, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
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

on:
  pull_request:
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'supabase/**'
      - 'e2e/**'
      - 'tests/**'
      - 'package.json'
      - 'package-lock.json'
      - 'playwright.config.ts'
      - 'tsconfig.base.json'
      - '.github/workflows/platform-ci.yml'
  push:
    branches: [main]
    paths:
      - 'apps/**'
      - 'packages/**'
      - 'supabase/**'
      - 'e2e/**'
      - 'tests/**'
      - 'package.json'
      - 'package-lock.json'
      - 'playwright.config.ts'
      - 'tsconfig.base.json'
      - '.github/workflows/platform-ci.yml'

jobs:
  code:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build

  database:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx supabase start
      - run: npx supabase db reset
      - run: npx supabase test db

  browser:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run e2e
```

- [ ] **Step 4: Run the workflow test and complete local verification**

Run:

```bash
node --test tests/ci-workflow.test.mjs
npm run typecheck
npm test
npm run build
npx supabase db reset
npx supabase test db
npm run e2e
```

Expected: every command exits 0.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/platform-ci.yml tests/ci-workflow.test.mjs
git commit -m "ci: verify platform foundation"
```

---

### Task 10: Document local development and architectural boundaries

**Files:**
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
  const [architecture, operations] = await Promise.all([
    readFile(new URL('../docs/architecture/platform-foundation.md', import.meta.url), 'utf8'),
    readFile(new URL('../docs/operations/local-development.md', import.meta.url), 'utf8'),
  ]);

  for (const statement of [
    'PostgreSQL is the only master data source',
    'R2 is the only master binary attachment source',
    'authorization is enforced by the API',
  ]) {
    assert.match(architecture, new RegExp(statement, 'i'));
  }

  for (const command of [
    'npm ci',
    'npx supabase start',
    'npm run dev:api',
    'npm run dev:web',
    'npm run e2e',
  ]) {
    assert.match(operations, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
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

- `apps/web` is the authenticated React user interface.
- `apps/api` is the only application boundary allowed to authorize governed data and file operations.
- `packages/contracts` publishes shared request, response, user-context, and permission types.
- Supabase Auth issues user tokens.
- Supabase PostgreSQL is the only master data source.
- Cloudflare R2 is the only master binary attachment source.

## Authorization

Authorization is enforced by the API. PostgreSQL row-level security is defense in depth. A browser must not receive a Supabase service-role key, direct R2 credentials, or a permanent private-file URL.

The API verifies the Supabase JWT through the project JWKS endpoint, calls `get_current_user_context()` with the user token, and checks the published permission vocabulary before executing a protected route.

## Data and file boundaries

Existing Excel, JSON, HTML, and JavaScript datasets remain migration inputs or visual references. They are not production masters. Later domain plans must write approved records to PostgreSQL and store governed attachments in R2.

## Public platform routes

Only `/api/v1/health` is public in the foundation. `/api/v1/me` requires authentication and `platform.read`.

## Extension rules

New domains must add shared schemas to `@wison/contracts`, mount routes under `/api/v1`, add database changes through ordered migrations, enforce permissions in the API, and include unit, database, browser, and authorization tests appropriate to the change.
```

- [ ] **Step 4: Write the local-development runbook**

Create `docs/operations/local-development.md`:

```markdown
# Local Platform Development

## Prerequisites

- Node.js 22.x
- npm
- Docker compatible with the Supabase local stack
- A Cloudflare account only when remote resources or deployment are required

## Install

```bash
npm ci
```

## Start local Supabase

```bash
npx supabase start
npx supabase db reset
```

## Configure API secrets

Create `apps/api/.dev.vars` with:

```text
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_PUBLISHABLE_KEY=<copy the local anon or publishable key printed by supabase start>
```

Do not commit `.dev.vars`.

## Start applications

Terminal 1:

```bash
npm run dev:api -- --port 8787
```

Terminal 2:

```bash
VITE_API_BASE_URL=http://127.0.0.1:8787 npm run dev:web -- --host 127.0.0.1 --port 4173
```

Open `http://127.0.0.1:4173`.

## Verify

```bash
npm run typecheck
npm test
npm run build
npx supabase db reset
npx supabase test db
npm run e2e
```

## Local ports

- Web: 4173
- API: 8787
- Supabase API: 54321
- PostgreSQL: 54322
- Supabase Studio: 54323

## Secret handling

Never place Supabase service-role credentials, Cloudflare API tokens, R2 access keys, or production user tokens in source files, browser environment variables, test snapshots, or logs.
```

- [ ] **Step 5: Run the documentation and full foundation verification**

Run:

```bash
node --test tests/platform-docs.test.mjs
npm run typecheck
npm test
npm run build
npx supabase db reset
npx supabase test db
npm run e2e
```

Expected: every command exits 0; no test is skipped.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture/platform-foundation.md docs/operations/local-development.md tests/platform-docs.test.mjs
git commit -m "docs: document platform foundation"
```

---

## 2. Final review gate

Before declaring the plan complete, run all commands from a clean checkout of the feature branch:

```bash
npm ci
npm run typecheck
npm test
npm run build
npx supabase start
npx supabase db reset
npx supabase test db
npm run e2e
```

Then verify the branch contains:

```bash
git log --oneline --decorate -10
git status --short
git diff main...HEAD --stat
```

Expected evidence:

1. `git status --short` is empty.
2. Every verification command exits 0.
3. The API dry-run bundle is produced.
4. The web production bundle is produced.
5. The pgTAP suite reports 14 passing assertions.
6. The Playwright suite reports one passing Chromium smoke test.
7. No existing static prototype, generated company page, map dataset, report dataset, or chart asset was deleted.
8. No secret or real production credential is present in the diff.

## 3. Foundation acceptance criteria

The reviewer accepts this plan only when:

- A clean checkout installs with Node.js 22 and `npm ci`.
- All workspace types compile in strict mode.
- Shared contracts are the single source for health, user-context, and permission types.
- `/api/v1/health` is public and typed.
- `/api/v1/me` rejects unauthenticated and unauthorized requests.
- Supabase migrations create four security levels, four rights types, six roles, and thirteen permissions.
- The API verifies asymmetric Supabase JWTs through the project JWKS endpoint.
- The API obtains active-user roles and permissions through `get_current_user_context()`.
- R2 access is behind `ObjectStorage`; no public file route is introduced.
- The React shell exposes all top-level product routes without implementing domain features.
- Unit, database, browser, and CI checks pass.
- Local development and architecture boundaries are documented.

## 4. Explicitly deferred to subsequent plans

The following work must not be added to this branch:

- Company schema, migration, API, or UI.
- Project schema, migration, API, map, or UI.
- Report schema, attachment routes, preview, extraction, or UI.
- Unified search implementation.
- Favorites, recent views, saved searches, subscriptions, notification records, or correction requests.
- Admin CRUD, staged imports, deduplication, review, publication, or data-quality dashboards.
- Production deployment credentials or domain configuration.
- Vector columns, embedding jobs, semantic retrieval, or AI answers.

These items are covered by the later plans listed in `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`.
