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
