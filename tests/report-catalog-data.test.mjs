import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

test('merged report catalog is reproducible and normalized without invented attachments', async () => {
  execFileSync(process.execPath, ['scripts/build-report-catalog.mjs', '--check'], {
    cwd: repositoryRoot,
    stdio: 'pipe',
  });

  const catalog = JSON.parse(
    await readFile(new URL('../data/report-catalog.json', import.meta.url), 'utf8'),
  );
  assert.equal(catalog.schemaVersion, 1);
  assert.equal(catalog.syncedOn, '2026-08-04');
  assert.equal(catalog.reports.length, 1_111);
  assert.deepEqual(
    [...new Set(catalog.reports.map(({ informationType }) => informationType))].sort(),
    ['ESG与可持续发展报告', '年度综合报告', '行业研究报告', '财务报告'].sort(),
  );
  assert.deepEqual(
    [...new Set(catalog.reports.map(({ sourceFamily }) => sourceFamily))].sort(),
    ['公司披露', '行业研究'],
  );
  assert.ok(catalog.reports.every(({ publisher }) => publisher && publisher !== '来源'));
  assert.ok(catalog.reports.every(({ region }) => region));
  assert.ok(catalog.reports.every(({ attachmentAvailable }) => !attachmentAvailable));
  assert.equal(new Set(catalog.reports.map(({ id }) => id)).size, 1_111);
  assert.equal(catalog.quality.blankTitles, 0);
  assert.equal(catalog.quality.duplicateIds, 0);
});
