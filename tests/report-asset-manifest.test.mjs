import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));

test('stores report and logo metadata in PostgreSQL while keeping binaries in R2', async () => {
  const migration = await readFile(new URL('../supabase/migrations/202608110001_report_assets_and_company_logos.sql', import.meta.url), 'utf8');
  assert.match(migration, /create table app_private\.report_assets/);
  assert.match(migration, /create table app_private\.company_brand_assets/);
  assert.match(migration, /object_key text not null/);
  assert.doesNotMatch(migration, /bytea/i);
  assert.match(migration, /refresh_report_attachment_available/);
});

test('matches multiple report files, covers, and company logos without storing binaries in PostgreSQL', async () => {
  const work = await mkdtemp(join(tmpdir(), 'report-assets-'));
  const attachments = join(work, 'attachments');
  const covers = join(work, 'covers');
  const logos = join(work, 'logos');
  const derivatives = join(work, 'derivatives');
  await Promise.all([attachments, covers, logos].map((path) => mkdir(path)));
  await writeFile(join(attachments, 'Middle East LNG Supply, Demand and Project Outlook 2026.pdf'), '%PDF-1.7\ntest');
  await writeFile(join(attachments, 'Middle East LNG Supply, Demand and Project Outlook 2026.xlsx'), Buffer.from([0x50, 0x4b, 0x03, 0x04, 1]));
  await writeFile(join(attachments, 'unmatched.pdf'), '%PDF-1.7\nunmatched');
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
  await writeFile(join(covers, '中东 LNG 供需与项目扩张展望 2026.png'), png);
  await writeFile(join(logos, 'adnoc.png'), png);
  const catalogPath = join(work, 'catalog.json');
  await writeFile(catalogPath, JSON.stringify({ reports: [{
    id: 'lng-middle-east-2026', title: '中东 LNG 供需与项目扩张展望 2026',
    subtitle: 'Middle East LNG Supply, Demand and Project Outlook 2026',
  }] }));
  const companiesPath = join(work, 'companies.json');
  await writeFile(companiesPath, JSON.stringify({ companies: [{ slug: 'adnoc' }] }));
  const output = join(work, 'manifest.json');

  execFileSync(process.execPath, [
    'scripts/build-report-asset-manifest.mjs',
    `--catalog=${catalogPath}`,
    `--companies=${companiesPath}`,
    `--attachments-root=${attachments}`,
    `--covers-root=${covers}`,
    `--logos-root=${logos}`,
    `--derivatives-root=${derivatives}`,
    `--output=${output}`,
  ], { cwd: repositoryRoot, stdio: 'pipe' });

  const manifest = JSON.parse(await readFile(output, 'utf8'));
  assert.equal(manifest.reportAssets.filter(({ kind }) => kind === 'attachment').length, 2);
  assert.equal(manifest.reportAssets.filter(({ kind }) => kind === 'cover').length, 1);
  assert.equal(manifest.companyLogos.length, 1);
  assert.equal(manifest.unmatchedAttachments.length, 1);
  assert.ok(manifest.objects.every(({ objectKey }) => !objectKey.includes('unmatched')));
  assert.equal(manifest.quarantineObjects.length, 1);
  assert.match(manifest.quarantineObjects[0].objectKey, /^report-assets\/unmatched\/[a-f0-9]{64}\.pdf$/);
  assert.ok(manifest.reportAssets.every(({ objectKey, sha256 }) => objectKey.includes(sha256)));
});

test('renders a transactional linked-database sync with count verification', async () => {
  const work = await mkdtemp(join(tmpdir(), 'report-asset-sql-'));
  const manifestPath = join(work, 'manifest.json');
  const outputPath = join(work, 'assets.sql');
  await writeFile(manifestPath, JSON.stringify({
    reportAssets: [{
      reportId: 'report-one', id: '0123456789abcdef01234567', kind: 'attachment',
      originalFileName: "Analyst's report.pdf", objectKey: `report-assets/published/attachments/${'a'.repeat(64)}.pdf`,
      sourceObjectKey: null, sha256: 'a'.repeat(64), sourceSha256: null,
      mimeType: 'application/pdf', byteSize: 100, rightsType: 'LICENSED_RESTRICTED',
      securityLevel: 'L1', reviewStatus: 'approved',
    }],
    companyLogos: [],
  }));

  execFileSync(process.execPath, [
    'scripts/render-report-assets-sql.mjs',
    `--manifest=${manifestPath}`,
    `--output=${outputPath}`,
  ], { cwd: repositoryRoot, stdio: 'pipe' });

  const sql = await readFile(outputPath, 'utf8');
  assert.match(sql, /^begin;/);
  assert.match(sql, /jsonb_to_recordset\(\$report_assets\$/);
  assert.match(sql, /Analyst's report\.pdf/);
  assert.match(sql, /raise exception 'Report asset verification failed/);
  assert.match(sql, /commit;/);
  assert.doesNotMatch(sql, /bytea/i);
});
