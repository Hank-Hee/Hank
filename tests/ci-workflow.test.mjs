import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('platform CI runs code, database, and browser verification', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/platform-ci.yml', import.meta.url),
    'utf8',
  );
  const apiPackage = JSON.parse(await readFile(
    new URL('../apps/api/package.json', import.meta.url),
    'utf8',
  ));

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
    'npx supabase db reset --version 202607310000 --no-seed',
    'npx supabase db query --local --file supabase/rollback/202607310001_platform_foundation_down.sql',
    'npx supabase test db supabase/rollback-tests/platform_foundation_absent_test.sql',
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
  assert.match(workflow, /for attempt in 1 2/);
  assert.match(workflow, /npx supabase stop --no-backup/);
  assert.match(workflow, /npx supabase start --debug/);
  assert.match(workflow, /DATABASE_URL: postgresql:\/\/postgres:postgres@127\.0\.0\.1:54322\/postgres/);
  assert.match(apiPackage.scripts.dev, /\$\{DATABASE_URL:-postgresql:\/\/\$USER@127\.0\.0\.1\/hank_platform_test\}/);
  assert.doesNotMatch(workflow, /^\s+paths:/m);
});

test('public UAT load tiers run independently instead of stacking their concurrency', async () => {
  const workflow = await readFile(
    new URL('../.github/workflows/public-uat-audit.yml', import.meta.url),
    'utf8',
  );
  assert.match(workflow, /max-parallel:\s*1/);
  assert.match(workflow, /concurrency:\s*200\s+requests:\s*2000\s+max_p95_ms:\s*1500/);
  assert.match(workflow, /--max-p95-ms \$\{\{ matrix\.max_p95_ms \}\}/);
});
