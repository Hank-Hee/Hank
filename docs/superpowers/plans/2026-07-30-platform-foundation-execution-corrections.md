# Platform Foundation — Mandatory Execution Corrections

> **MANDATORY GOVERNANCE HOLD (2026-07-31):** This file does not authorize any new Task. Foundation is paused after Task 1. The corrections apply only when reviewing or reproducing evidence under the legacy `2026-07-30-platform-foundation.md`; they cannot override the PRD, acceptance standard, or any newly approved downstream document.

> **Status:** Mandatory companion only to the legacy `2026-07-30-platform-foundation.md` while that plan remains applicable.
>
> Codex must read this file after the main plan and apply every correction below. Where this file conflicts with the main plan, this file wins.

## 1. `.gitignore` correction

In Task 1, the `.gitignore` additions must be exactly:

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

Reason: Task 8 intentionally commits `apps/web/.env.test`, which only contains a localhost API URL and no secret.

## 2. Authentication test type correction

In Task 6, replace the authorized-user test body with this complete code:

```ts
it('returns the authorized user context', async () => {
  const user: UserContext = {
    ...identity,
    roles: ['sales_bd'],
    permissions: ['platform.read'],
  };
  const app = createApp(factoryFor(user));
  const response = await app.request('/api/v1/me', {
    headers: { authorization: 'Bearer valid-token' },
  });

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(user);
});
```

The test file must import `UserContext` as a type:

```ts
import type { UserContext } from '@wison/contracts';
```

Do not use `as const` on the `permissions` array because `UserContext.permissions` is mutable.

## 3. Replace Task 6 Step 5 with the full `app.ts`

Do not use the incomplete “keep the existing handlers and add these lines” snippet in the main plan. Replace `apps/api/src/app.ts` with this complete file:

```ts
import type { ApiErrorResponse } from '@wison/contracts';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { SupabaseJwtVerifier } from './auth/supabase-jwt-verifier';
import { SupabasePermissionLoader } from './auth/supabase-permission-loader';
import type { AuthServicesFactory } from './auth/types';
import { AppError } from './lib/app-error';
import { authenticate } from './middleware/authenticate';
import { requestIdMiddleware } from './middleware/request-id';
import { requirePermission } from './middleware/require-permission';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
import type { AppEnvironment } from './types';

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

  const protectedMe = new Hono<AppEnvironment>();
  protectedMe.use('*', authenticate(authServicesFactory));
  protectedMe.use('*', requirePermission('platform.read'));
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

    return context.json(response, appError.status);
  });

  return app;
}
```

This route composition applies auth middleware to both `/api/v1/me` and any future child route mounted inside `protectedMe`.

## 4. R2 stream type correction

In both `ObjectStorage` and `R2ObjectStorage`, use this body type:

```ts
ReadableStream<Uint8Array> | ArrayBuffer | string
```

Do not use an unparameterized `ReadableStream`.

## 5. Local Supabase credential command

In Task 10, replace the manual credential placeholder with this exact shell sequence after `npx supabase start`:

```bash
eval "$(npx supabase status -o env)"
printf 'SUPABASE_URL=%s\nSUPABASE_PUBLISHABLE_KEY=%s\n' "$API_URL" "$ANON_KEY" > apps/api/.dev.vars
```

Then verify the file contains two non-empty values without printing the values into CI logs:

```bash
test -s apps/api/.dev.vars
grep -q '^SUPABASE_URL=http' apps/api/.dev.vars
grep -q '^SUPABASE_PUBLISHABLE_KEY=.' apps/api/.dev.vars
```

`apps/api/.dev.vars` must remain ignored and uncommitted.

## 6. Future plan filename rule

The roadmap examples containing `2026-08-xx` are illustrative only and must not be created literally. Each future plan uses its actual creation date:

```text
docs/superpowers/plans/YYYY-MM-DD-company-domain.md
docs/superpowers/plans/YYYY-MM-DD-project-domain.md
docs/superpowers/plans/YYYY-MM-DD-report-document-domain.md
docs/superpowers/plans/YYYY-MM-DD-unified-search-workflow.md
docs/superpowers/plans/YYYY-MM-DD-admin-ingestion-data-quality.md
docs/superpowers/plans/YYYY-MM-DD-hardening-deployment-pilot.md
docs/superpowers/plans/YYYY-MM-DD-rag-readiness.md
```

Codex must not generate empty future plan files during the foundation phase.

## 7. Legacy execution order — disabled during governance hold

The former required reading order, retained for historical review, is:

1. `docs/superpowers/specs/2026-07-30-oil-gas-knowledge-platform-design.md`
2. `docs/superpowers/plans/2026-07-30-oil-gas-platform-roadmap.md`
3. `docs/superpowers/plans/2026-07-30-platform-foundation.md`
4. `docs/superpowers/plans/2026-07-30-platform-foundation-execution-corrections.md`

While reviewing evidence claimed under the legacy plan, this correction file must remain in context. Do not use this order to start Task 2 or any later Task while the governance hold is active.
