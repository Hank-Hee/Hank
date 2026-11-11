import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, mkdir, open, readdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, relative, resolve, sep } from 'node:path';
import sharp from 'sharp';

const maximumByteSize = 250 * 1024 * 1024;
const formats = new Map([
  ['.pdf', { mimeType: 'application/pdf', signature: 'pdf' }],
  ['.xlsx', { mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', signature: 'zip' }],
  ['.xlsb', { mimeType: 'application/vnd.ms-excel.sheet.binary.macroEnabled.12', signature: 'zip' }],
]);

const options = parseArguments(process.argv.slice(2));
const catalog = JSON.parse(await readFile(requiredPath(options, '--catalog'), 'utf8'));
const overrides = options.get('--overrides')
  ? JSON.parse(await readFile(resolve(options.get('--overrides')), 'utf8'))
  : { attachments: {} };
const companies = await readCompanies(options.get('--companies'));
const attachmentRoot = await realpath(requiredPath(options, '--attachments-root'));
const coverRoot = await realpath(requiredPath(options, '--covers-root'));
const logoRoot = await realpath(requiredPath(options, '--logos-root'));
const derivativeRoot = resolve(requiredPath(options, '--derivatives-root'));
const outputPath = resolve(requiredPath(options, '--output'));
await mkdir(derivativeRoot, { recursive: true });

const matcher = createMatcher(catalog.reports);
const reportAssets = [];
const companyLogos = [];
const objectsByKey = new Map();
const quarantineObjectsByKey = new Map();
const unmatchedAttachments = [];
const unmatchedCovers = [];
const invalidFiles = [];
const seenReportAssets = new Set();
const coveredReports = new Set();

for (const path of await walkFiles(attachmentRoot)) {
  const relativePath = portableRelative(attachmentRoot, path);
  if (isIgnored(relativePath)) continue;
  const format = formats.get(extname(path).toLocaleLowerCase('en-US'));
  if (!format) continue;
  const validation = await validateFile(path, format.signature).catch((error) => ({ error: error.message }));
  if (validation.error) {
    invalidFiles.push({ sourceFile: relativePath, reason: validation.error });
    continue;
  }
  const match = matchOverride(overrides.attachments?.[relativePath], catalog.reports) ?? matcher(path);
  if (!match) {
    const sha256 = await hashFile(path);
    const extension = extname(path).toLocaleLowerCase('en-US');
    const objectKey = `report-assets/unmatched/${sha256}${extension}`;
    quarantineObjectsByKey.set(objectKey, {
      objectKey, sourcePath: path, sha256, mimeType: format.mimeType,
      byteSize: validation.byteSize, reason: 'No reliable report-catalog match',
    });
    unmatchedAttachments.push({ sourceFile: relativePath, sha256, quarantineObjectKey: objectKey });
    continue;
  }
  const sha256 = await hashFile(path);
  const extension = extname(path).toLocaleLowerCase('en-US');
  const objectKey = `report-assets/published/attachments/${sha256}${extension}`;
  objectsByKey.set(objectKey, { objectKey, sourcePath: path, sha256, mimeType: format.mimeType, byteSize: validation.byteSize });
  for (const report of match.reports) {
    const identity = `${report.id}:attachment:${sha256}`;
    if (seenReportAssets.has(identity)) continue;
    seenReportAssets.add(identity);
    reportAssets.push({
      reportId: report.id,
      id: stableId(identity),
      kind: 'attachment',
      originalFileName: basename(path),
      objectKey,
      sourceObjectKey: null,
      sha256,
      sourceSha256: null,
      mimeType: format.mimeType,
      byteSize: validation.byteSize,
      rightsType: 'LICENSED_RESTRICTED',
      securityLevel: 'L1',
      reviewStatus: 'approved',
      matchMode: match.mode,
      matchScore: match.score,
    });
  }
}

for (const path of await walkFiles(coverRoot)) {
  const relativePath = portableRelative(coverRoot, path);
  if (isIgnored(relativePath) || extname(path).toLocaleLowerCase('en-US') !== '.png') continue;
  const validation = await validateFile(path, 'png').catch((error) => ({ error: error.message }));
  if (validation.error) {
    invalidFiles.push({ sourceFile: relativePath, reason: validation.error });
    continue;
  }
  const match = matcher(path);
  if (!match) {
    unmatchedCovers.push({ sourceFile: relativePath });
    continue;
  }
  const uncoveredReports = match.reports.filter(({ id }) => !coveredReports.has(id));
  if (!uncoveredReports.length) continue;
  const sourceSha256 = await hashFile(path);
  const sourceObjectKey = `report-assets/source/covers/${sourceSha256}.png`;
  const derivativePath = resolve(derivativeRoot, `${sourceSha256}.webp`);
  await sharp(path).rotate().resize({ width: 640, height: 900, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 }).toFile(derivativePath);
  const derivativeStat = await stat(derivativePath);
  const sha256 = await hashFile(derivativePath);
  const objectKey = `report-assets/published/covers/${sha256}.webp`;
  objectsByKey.set(sourceObjectKey, {
    objectKey: sourceObjectKey, sourcePath: path, sha256: sourceSha256,
    mimeType: 'image/png', byteSize: validation.byteSize,
  });
  objectsByKey.set(objectKey, {
    objectKey, sourcePath: derivativePath, sha256, mimeType: 'image/webp', byteSize: derivativeStat.size,
  });
  for (const report of uncoveredReports) {
    const identity = `${report.id}:cover:${sourceSha256}`;
    if (seenReportAssets.has(identity)) continue;
    seenReportAssets.add(identity);
    coveredReports.add(report.id);
    reportAssets.push({
      reportId: report.id,
      id: stableId(identity),
      kind: 'cover',
      originalFileName: basename(path),
      objectKey,
      sourceObjectKey,
      sha256,
      sourceSha256,
      mimeType: 'image/webp',
      byteSize: derivativeStat.size,
      rightsType: 'LICENSED_RESTRICTED',
      securityLevel: 'L1',
      reviewStatus: 'approved',
      matchMode: match.mode,
      matchScore: match.score,
    });
  }
}

const companySlugs = new Set(companies.companies.map(({ slug }) => slug));
for (const path of await walkFiles(logoRoot)) {
  const relativePath = portableRelative(logoRoot, path);
  if (isIgnored(relativePath) || extname(path).toLocaleLowerCase('en-US') !== '.png') continue;
  const sourceSlug = basename(path, extname(path));
  const companySlug = new Map([['united-oil-and-gas', 'united-oil-gas']]).get(sourceSlug) ?? sourceSlug;
  if (!companySlugs.has(companySlug)) {
    invalidFiles.push({ sourceFile: relativePath, reason: `Unknown company slug: ${companySlug}` });
    continue;
  }
  const validation = await validateFile(path, 'png').catch((error) => ({ error: error.message }));
  if (validation.error) {
    invalidFiles.push({ sourceFile: relativePath, reason: validation.error });
    continue;
  }
  const sha256 = await hashFile(path);
  const objectKey = `company-assets/published/logos/${companySlug}/${sha256}.png`;
  objectsByKey.set(objectKey, { objectKey, sourcePath: path, sha256, mimeType: 'image/png', byteSize: validation.byteSize });
  companyLogos.push({ companySlug, objectKey, sha256, mimeType: 'image/png', byteSize: validation.byteSize });
}

reportAssets.sort((left, right) => left.reportId.localeCompare(right.reportId) || left.kind.localeCompare(right.kind) || left.id.localeCompare(right.id));
companyLogos.sort((left, right) => left.companySlug.localeCompare(right.companySlug));
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  reportAssets,
  companyLogos,
  objects: [...objectsByKey.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
  quarantineObjects: [...quarantineObjectsByKey.values()].sort((left, right) => left.objectKey.localeCompare(right.objectKey)),
  unmatchedAttachments,
  unmatchedCovers,
  invalidFiles,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({
  reportAssets: reportAssets.length,
  attachmentRelations: reportAssets.filter(({ kind }) => kind === 'attachment').length,
  coverRelations: reportAssets.filter(({ kind }) => kind === 'cover').length,
  companyLogos: companyLogos.length,
  objects: manifest.objects.length,
  quarantineObjects: manifest.quarantineObjects.length,
  unmatchedAttachments: unmatchedAttachments.length,
  unmatchedCovers: unmatchedCovers.length,
  invalidFiles: invalidFiles.length,
  output: outputPath,
}));

function createMatcher(reports) {
  const variants = new Map();
  for (const report of reports) {
    for (const value of [report.title, report.subtitle]) {
      if (!value) continue;
      const key = normalizeTitle(value);
      if (!variants.has(key)) variants.set(key, []);
      variants.get(key).push(report);
    }
  }
  return (path) => {
    const candidates = [...new Set([normalizeTitle(basename(dirname(path))), normalizeTitle(basename(path))].filter(Boolean))];
    for (const candidate of candidates) {
      const exact = variants.get(candidate);
      if (exact?.length) return { reports: exact, mode: 'exact', score: 1 };
    }
    let best;
    let second = 0;
    for (const candidate of candidates) {
      for (const [variant, matchedReports] of variants) {
        if (!yearsCompatible(candidate, variant)) continue;
        const score = trigramSimilarity(candidate, variant);
        if (!best || score > best.score) {
          second = best?.score ?? second;
          best = { reports: matchedReports, mode: 'fuzzy', score };
        } else if (score > second) second = score;
      }
    }
    return best && best.score >= 0.78 && best.score - second >= 0.04 ? best : null;
  };
}

function matchOverride(ids, reports) {
  if (!ids) return null;
  const reportIds = Array.isArray(ids) ? ids : [ids];
  const matchedReports = reportIds.map((id) => reports.find((report) => report.id === id));
  if (matchedReports.some((report) => !report)) throw new Error(`Asset override contains an unknown report ID: ${reportIds.join(', ')}`);
  return { reports: matchedReports, mode: 'override', score: 1 };
}

function normalizeTitle(value) {
  return value.normalize('NFKC').toLocaleLowerCase('en-US')
    .replace(/\.[a-z0-9]{2,5}$/u, '')
    .replace(/^rystad energy\s*-\s*\d+\s*-\s*/u, '')
    .replace(/^\d{4}[-_/]\d{1,2}[-_/]\d{1,2}(?:\s*-\s*|[-_/\s]+)/u, '')
    .replace(/\bucube\b/gu, ' ')
    .replace(/[ _-]\d{5,10}$/u, '')
    .replace(/\s*\((?:\d+|pdf)\)\s*$/u, '')
    .replace(/[’‘]/gu, "'")
    .replace(/[^\p{Letter}\p{Number}]+/gu, ' ')
    .trim().replace(/\s+/gu, ' ');
}

function yearsCompatible(left, right) {
  const years = (value) => new Set(value.match(/(?:19|20)\d{2}/gu) ?? []);
  const leftYears = years(left), rightYears = years(right);
  if (!leftYears.size || !rightYears.size) return true;
  return [...leftYears].some((year) => rightYears.has(year));
}

function trigramSimilarity(left, right) {
  const grams = (value) => {
    const compact = value.replace(/\s/gu, '');
    const result = new Set();
    for (let index = 0; index < Math.max(1, compact.length - 2); index++) result.add(compact.slice(index, index + 3));
    return result;
  };
  const a = grams(left), b = grams(right);
  let overlap = 0;
  for (const value of a) if (b.has(value)) overlap++;
  return overlap / Math.max(a.size, b.size, 1);
}

async function walkFiles(root) {
  const output = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isSymbolicLink()) continue;
    if (entry.isDirectory()) output.push(...await walkFiles(path));
    else if (entry.isFile()) output.push(path);
  }
  return output;
}

function isIgnored(path) {
  const lower = path.toLocaleLowerCase('en-US');
  return lower.includes('/_debug/') || lower.startsWith('_debug/')
    || lower.endsWith('/desktop.ini') || lower === 'desktop.ini'
    || lower.endsWith('/.ds_store') || lower === '.ds_store';
}

async function validateFile(path, signature) {
  const metadata = await lstat(path);
  if (!metadata.isFile() || metadata.isSymbolicLink()) throw new Error('File is not a regular file.');
  if (metadata.size <= 0 || metadata.size > maximumByteSize) throw new Error('File size is outside the approved range.');
  const handle = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(8);
    const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0);
    const head = bytes.subarray(0, bytesRead);
    const valid = signature === 'pdf'
      ? head.subarray(0, 5).toString('ascii') === '%PDF-'
      : signature === 'zip'
        ? head.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]))
        : head.equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    if (!valid) throw new Error(`File signature does not match ${signature}.`);
  } finally {
    await handle.close();
  }
  return { byteSize: metadata.size };
}

async function hashFile(path) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest('hex');
}

function stableId(value) { return createHash('sha256').update(value).digest('hex').slice(0, 24); }
function portableRelative(root, path) { return relative(root, path).split(sep).join('/'); }

function parseArguments(values) {
  const parsed = new Map();
  for (const value of values) {
    const separator = value.indexOf('=');
    if (!value.startsWith('--') || separator < 3) throw new Error(`Invalid argument: ${value}`);
    parsed.set(value.slice(0, separator), value.slice(separator + 1));
  }
  return parsed;
}

function requiredPath(arguments_, name) {
  const value = arguments_.get(name);
  if (!value) throw new Error(`Missing required argument: ${name}`);
  return resolve(value);
}

async function readCompanies(explicitPath) {
  if (explicitPath) return JSON.parse(await readFile(resolve(explicitPath), 'utf8'));
  const seed = await readFile(resolve('supabase/seed.sql'), 'utf8');
  const slugs = [...seed.matchAll(/insert into app_private\.companies[^\n]+values \('([^']+)'/gu)]
    .map((match) => match[1]);
  if (!slugs.length) throw new Error('No company slugs were found in supabase/seed.sql.');
  return { companies: [...new Set(slugs)].map((slug) => ({ slug })) };
}
