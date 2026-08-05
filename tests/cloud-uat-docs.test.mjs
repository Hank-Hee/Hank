import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('launch documentation records public-read boundaries, load and attachment storage decisions', async () => {
  const runbook = await readFile(
    new URL('../docs/knowledge-platform-launch/05-cloud-uat-runbook.md', import.meta.url),
    'utf8',
  );
  for (const phrase of [
    'Cloudflare Access',
    'PUBLIC_READ_ONLY=true',
    '20–100',
    'private R2',
    'PostgreSQL',
    '/api/v1/me',
    'npm run uat:load',
    'wison-knowledge-platform.wison.workers.dev',
    'market-data/oil-gas-prices/latest.json',
  ]) assert.match(runbook, new RegExp(phrase, 'i'));
  assert.doesNotMatch(runbook, /提供邮箱登录入口/);
  assert.match(runbook, /公司、报告和看板允许匿名 GET/);
});
