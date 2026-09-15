import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('..', import.meta.url));
const catalog = JSON.parse(await readFile(new URL('../data/report-catalog.json', import.meta.url), 'utf8'));

test('prepares approved PDF, Excel and PowerPoint attachments for private R2', async () => {
  const work = await mkdtemp(join(tmpdir(), 'report-attachments-'));
  const files = join(work, 'files');
  await mkdir(files);
  const samples = [
    ['report.pdf', Buffer.from('%PDF-1.7\nexample')],
    ['workbook.xlsx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3])],
    ['slides.pptx', Buffer.from([0x50, 0x4b, 0x03, 0x04, 4, 5, 6])],
  ];
  await Promise.all(samples.map(([name, body]) => writeFile(join(files, name), body)));
  const manifest = {
    schemaVersion: 1,
    batchId: 'uat-2026-08-04-001',
    attachments: samples.map(([file], index) => ({
      reportId: catalog.reports[index].id,
      file,
      rightsType: 'PUBLIC_THIRD_PARTY',
      securityLevel: 'L1',
      reviewStatus: 'approved',
    })),
  };
  const manifestPath = join(work, 'manifest.json');
  const outputPath = join(work, 'prepared.json');
  await writeFile(manifestPath, JSON.stringify(manifest));

  execFileSync(process.execPath, [
    'scripts/prepare-report-attachments.mjs',
    `--manifest=${manifestPath}`,
    `--attachments-root=${files}`,
    `--output=${outputPath}`,
  ], { cwd: repositoryRoot, stdio: 'pipe' });

  const prepared = JSON.parse(await readFile(outputPath, 'utf8'));
  assert.equal(prepared.attachments.length, 3);
  assert.deepEqual(prepared.attachments.map(({ mimeType }) => mimeType).sort(), [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  ].sort());
  for (const attachment of prepared.attachments) {
    assert.match(attachment.sha256, /^[a-f0-9]{64}$/);
    assert.ok(attachment.byteSize > 0);
    assert.match(attachment.quarantineObjectKey, /^report-attachments\/quarantine\/uat-2026-08-04-001\//);
    assert.match(attachment.publishedObjectKey, /^report-attachments\/published\//);
  }
});

test('rejects unsupported files before any cloud upload', async () => {
  const work = await mkdtemp(join(tmpdir(), 'report-attachments-invalid-'));
  const file = join(work, 'unsafe.exe');
  await writeFile(file, 'not an approved document');
  const manifestPath = join(work, 'manifest.json');
  await writeFile(manifestPath, JSON.stringify({
    schemaVersion: 1,
    batchId: 'uat-2026-08-04-invalid',
    attachments: [{
      reportId: catalog.reports[0].id,
      file: 'unsafe.exe',
      rightsType: 'PUBLIC_THIRD_PARTY',
      securityLevel: 'L1',
      reviewStatus: 'approved',
    }],
  }));

  assert.throws(() => execFileSync(process.execPath, [
    'scripts/prepare-report-attachments.mjs',
    `--manifest=${manifestPath}`,
    `--attachments-root=${work}`,
  ], { cwd: repositoryRoot, stdio: 'pipe' }), /Command failed/);
});
