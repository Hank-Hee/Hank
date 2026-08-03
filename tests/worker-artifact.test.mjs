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
