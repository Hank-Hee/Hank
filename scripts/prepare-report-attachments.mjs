import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readFile, realpath, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const maximumByteSize = 250 * 1024 * 1024;
const rightsTypes = new Set(['OWNED', 'PUBLIC_THIRD_PARTY', 'LICENSED_RESTRICTED', 'DERIVED_REVIEW_REQUIRED']);
const securityLevels = new Set(['L1', 'L2', 'L3', 'L4']);
const formats = new Map([
  ['.pdf', { mimeType: 'application/pdf', signature: 'pdf' }],
  ['.xlsx', { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', signature: 'zip' }],
  ['.xls', { mimeType: 'application/vnd.ms-excel', signature: 'ole' }],
  ['.pptx', { mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', signature: 'zip' }],
  ['.ppt', { mimeType: 'application/vnd.ms-powerpoint', signature: 'ole' }],
]);

const options = parseArguments(process.argv.slice(2));
const manifestPath = requiredPath(options, '--manifest');
const attachmentsRoot = await realpath(requiredPath(options, '--attachments-root'));
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const catalog = JSON.parse(await readFile(resolve(repositoryRoot, 'data/report-catalog.json'), 'utf8'));
const reportIds = new Set(catalog.reports.map(({ id }) => id));
const prepared = await prepareManifest(manifest, attachmentsRoot, reportIds);

const outputPath = options.get('--output');
if (outputPath) {
  await mkdir(dirname(resolve(outputPath)), { recursive: true });
  await writeFile(resolve(outputPath), `${JSON.stringify(prepared, null, 2)}\n`);
}
console.log(JSON.stringify({
  batchId: prepared.batchId,
  attachmentCount: prepared.attachments.length,
  totalByteSize: prepared.attachments.reduce((total, item) => total + item.byteSize, 0),
  output: outputPath ? resolve(outputPath) : null,
}));

async function prepareManifest(value, root, knownReportIds) {
  if (value?.schemaVersion !== 1) throw new Error('Attachment manifest schemaVersion must be 1.');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value.batchId ?? '') || value.batchId.length > 80) {
    throw new Error('Attachment manifest batchId is invalid.');
  }
  if (!Array.isArray(value.attachments) || !value.attachments.length) {
    throw new Error('Attachment manifest must contain at least one attachment.');
  }
  const seenReportIds = new Set();
  const attachments = [];
  for (const item of value.attachments) {
    if (!knownReportIds.has(item?.reportId)) throw new Error(`Unknown report ID: ${item?.reportId ?? ''}`);
    if (seenReportIds.has(item.reportId)) throw new Error(`Duplicate report ID: ${item.reportId}`);
    seenReportIds.add(item.reportId);
    if (!rightsTypes.has(item.rightsType)) throw new Error(`Invalid rights type for ${item.reportId}.`);
    if (!securityLevels.has(item.securityLevel)) throw new Error(`Invalid security level for ${item.reportId}.`);
    if (item.reviewStatus !== 'approved') throw new Error(`Attachment ${item.reportId} has not been approved.`);
    if (typeof item.file !== 'string' || !item.file || isAbsolute(item.file)) {
      throw new Error(`Attachment path for ${item.reportId} must be relative.`);
    }
    const requestedPath = resolve(root, item.file);
    const relativeRequestedPath = relative(root, requestedPath);
    if (relativeRequestedPath.startsWith(`..${sep}`) || relativeRequestedPath === '..' || isAbsolute(relativeRequestedPath)) {
      throw new Error(`Attachment path escapes the approved root: ${item.file}`);
    }
    const requestedMetadata = await lstat(requestedPath);
    if (requestedMetadata.isSymbolicLink() || !requestedMetadata.isFile()) {
      throw new Error(`Attachment must be a regular non-symlink file: ${item.file}`);
    }
    const sourcePath = await realpath(requestedPath);
    const relativeSourcePath = relative(root, sourcePath);
    if (relativeSourcePath.startsWith(`..${sep}`) || relativeSourcePath === '..' || isAbsolute(relativeSourcePath)) {
      throw new Error(`Attachment resolves outside the approved root: ${item.file}`);
    }
    if (requestedMetadata.size <= 0 || requestedMetadata.size > maximumByteSize) {
      throw new Error(`Attachment size is invalid for ${item.reportId}.`);
    }
    const extension = extname(item.file).toLocaleLowerCase('en-US');
    const format = formats.get(extension);
    if (!format) throw new Error(`Unsupported attachment format: ${extension || '(none)'}`);
    await verifySignature(sourcePath, format.signature, item.reportId);
    const sha256 = await hashFile(sourcePath);
    const objectName = `${sha256}${extension}`;
    attachments.push({
      reportId: item.reportId,
      sourceFile: relativeSourcePath.split(sep).join('/'),
      originalFileName: basename(item.file),
      rightsType: item.rightsType,
      securityLevel: item.securityLevel,
      reviewStatus: item.reviewStatus,
      sha256,
      mimeType: format.mimeType,
      byteSize: requestedMetadata.size,
      quarantineObjectKey: `report-attachments/quarantine/${value.batchId}/${item.reportId}/${objectName}`,
      publishedObjectKey: `report-attachments/published/${item.reportId}/${objectName}`,
    });
  }
  attachments.sort((left, right) => left.reportId.localeCompare(right.reportId));
  return { schemaVersion: 1, batchId: value.batchId, attachments };
}

async function verifySignature(path, signature, reportId) {
  const handle = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(8);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const head = bytes.subarray(0, bytesRead);
    const valid = signature === 'pdf'
      ? head.subarray(0, 5).toString('ascii') === '%PDF-'
      : signature === 'zip'
        ? head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        : head.equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]));
    if (!valid) throw new Error(`File signature does not match its extension for ${reportId}.`);
  } finally {
    await handle.close();
  }
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function parseArguments(arguments_) {
  const parsed = new Map();
  for (const argument of arguments_) {
    const separator = argument.indexOf('=');
    if (!argument.startsWith('--') || separator < 3) {
      throw new Error('Usage: node scripts/prepare-report-attachments.mjs --manifest=<json> --attachments-root=<directory> [--output=<json>]');
    }
    parsed.set(argument.slice(0, separator), argument.slice(separator + 1));
  }
  return parsed;
}

function requiredPath(arguments_, name) {
  const value = arguments_.get(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return resolve(value);
}
