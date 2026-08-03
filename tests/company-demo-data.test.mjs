import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const node = process.execPath;

test('company demo inventory is reproducible and contains eight complete company sources', async () => {
  execFileSync(node, ['scripts/build-company-demo-inventory.mjs', '--check'], {
    cwd: repositoryRoot,
    stdio: 'pipe',
  });
  execFileSync(node, ['scripts/build-company-demo-seed.mjs', '--check'], {
    cwd: repositoryRoot,
    stdio: 'pipe',
  });

  const inventory = JSON.parse(
    await readFile(new URL('../data/company-demo-inventory.json', import.meta.url), 'utf8'),
  );
  assert.deepEqual(
    inventory.companies.map(({ slug }) => slug),
    ['adnoc', 'bp', 'chevron', 'eni', 'exxonmobil', 'petronas', 'shell', 'totalenergies'],
  );

  for (const company of inventory.companies) {
    assert.match(company.sourceId, /^[a-f0-9]{24}$/);
    assert.ok(company.projectCount > 0);
    assert.equal(company.assets.length, 7);
    for (const asset of company.assets) {
      assert.equal(asset.status, 'present');
      assert.match(asset.sha256, /^[a-f0-9]{64}$/);
    }
  }
  assert.equal(inventory.news.status, 'not-provided');
});
