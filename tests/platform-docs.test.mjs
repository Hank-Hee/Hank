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
    'npx supabase db query --local --file supabase/roles.sql',
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
