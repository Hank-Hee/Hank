import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const news = JSON.parse(await readFile(new URL('../data/news-catalog.json', import.meta.url), 'utf8'));
const fid = JSON.parse(await readFile(new URL('../data/fid-projects.json', import.meta.url), 'utf8'));
const reports = JSON.parse(await readFile(new URL('../data/report-catalog.json', import.meta.url), 'utf8'));

test('news workbooks are merged by story while preserving multi-company relationships', () => {
  assert.equal(news.syncedOn, '2026-08-07');
  assert.equal(news.sourceRows, 3_204);
  assert.equal(news.news.length, 2_252);
  assert.equal(new Set(news.news.map(({ id }) => id)).size, news.news.length);
  assert.ok(news.news.every(({ title, subtitle, publishedOn }) => title && subtitle && publishedOn));
  assert.deepEqual(new Set(news.news.map(({ category }) => category)), new Set(news.categories));
  assert.equal(news.news.filter(({ companySlugs }) => companySlugs.length > 1).length, 335);
  const goldenPass = news.news.find(({ title }) => title.includes('Golden Pass合资项目'));
  assert.deepEqual(goldenPass?.companySlugs, ['exxonmobil', 'qatarenergy']);
});

test('FID data removes the historical-company dimension and deduplicates visible projects', () => {
  assert.equal(fid.syncedOn, '2026-08-07');
  assert.equal(fid.sourceRows, 8_038);
  assert.equal(fid.projects.length, 4_383);
  assert.equal(new Set(fid.projects.map(({ id }) => id)).size, fid.projects.length);
  assert.ok(fid.projects.every((project) => !Object.hasOwn(project, 'historicalCompany')));
  assert.ok(fid.projects.every(({ sourceIds }) => sourceIds.length >= 1));
  assert.equal(fid.projects.filter(({ companySlug }) => companySlug !== null).length, 1_424);
  assert.equal(new Set(fid.projects.filter(({ companySlug }) => companySlug).map(({ companySlug }) => companySlug)).size, 50);
});

test('the updated report workbook supplies publication dates without replacing the Rystad archive', () => {
  assert.equal(reports.syncedOn, '2026-08-07');
  assert.equal(reports.reports.length, 1_111);
  assert.equal(reports.reports.filter(({ publishedOn }) => publishedOn === null).length, 0);
  assert.equal(reports.reports.find(({ sourceRecordId }) => sourceRecordId === '6a1e3ee1c3776c4645a0c909')?.publishedOn, '2026-05-28');
});
