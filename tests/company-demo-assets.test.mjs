import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

test('company dashboard assets are built from the allowlisted source inventory', async () => {
  const output = await mkdtemp(join(tmpdir(), 'company-assets-'));
  execFileSync(
    process.execPath,
    ['scripts/build-company-demo-assets.mjs', `--output=${output}`],
    { cwd: repositoryRoot, stdio: 'pipe' },
  );

  for (const path of [
    'banners/shell.html',
    'maps/data/shell.json',
    'maps/vendor/leaflet.js',
    'charts/project-type/index.html',
    'production/shell.html',
    'production/exxon.html',
    'financial/shell.html',
    'financial/totalenergies.html',
  ]) {
    assert.ok((await stat(join(output, path))).size > 0, path);
  }
  const financialScript = await readFile(join(output, 'financial/dashboard.js'), 'utf8');
  assert.doesNotMatch(financialScript, /\.\.\/\.\.\/data/);
  const mapPage = await readFile(join(output, 'maps/index.html'), 'utf8');
  assert.match(mapPage, /vendor\/leaflet\.js/);
  assert.doesNotMatch(mapPage, /unpkg\.com\/leaflet/);
  const manifest = JSON.parse(await readFile(join(output, 'asset-manifest.json'), 'utf8'));
  assert.equal(manifest.companies.length, 8);
  assert.equal(manifest.projectCompanies.length, 68);
  assert.equal(manifest.protectedBy, '/company-assets/*');
});
