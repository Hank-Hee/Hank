import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const readJson = async (path) => JSON.parse(await readFile(new URL(path, root), 'utf8'));
const containsHan = (value) => /[\u3400-\u9fff]/u.test(JSON.stringify(value));

test('versioned English content covers every company and report without Chinese text', async () => {
  const [catalog, companies, reportTitles, values] = await Promise.all([
    readJson('data/report-catalog.json'),
    readJson('data/company-content-en.json'),
    readJson('data/report-title-en.json'),
    readJson('data/value-content-en.json'),
  ]);

  assert.equal(Object.keys(companies).length, 126);
  assert.equal(Object.keys(reportTitles).length, 1_111);
  assert.deepEqual(Object.keys(reportTitles).sort(), catalog.reports.map(({ id }) => id).sort());
  assert.equal(containsHan(companies), false);
  assert.equal(containsHan(reportTitles), false);
  assert.equal(Object.values(values).some(containsHan), false);
});
