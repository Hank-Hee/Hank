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
  assert.equal(wrangler.assets.html_handling, 'none');
  assert.equal(wrangler.assets.not_found_handling, 'single-page-application');
  assert.deepEqual(wrangler.assets.run_worker_first, ['/api/*', '/company-assets/*']);
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
