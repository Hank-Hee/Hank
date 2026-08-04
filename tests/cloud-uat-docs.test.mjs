import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('launch documentation records Access, load and attachment storage decisions', async () => {
  const runbook = await readFile(
    new URL('../docs/knowledge-platform-launch/05-cloud-uat-runbook.md', import.meta.url),
    'utf8',
  );
  for (const phrase of [
    'Cloudflare Access',
    'Cf-Access-Jwt-Assertion',
    '20–100',
    'private R2',
    'PostgreSQL',
    'CF_ACCESS_CLIENT_ID',
    'npm run uat:load',
  ]) assert.match(runbook, new RegExp(phrase, 'i'));
  assert.doesNotMatch(runbook, /提供邮箱登录入口/);
});
