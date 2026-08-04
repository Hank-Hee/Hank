import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const vendorPath = resolve(repositoryRoot, 'company-text-dashboard/vendor/xlsx.full.min.js');
const sourcePaths = {
  rystad: resolve(repositoryRoot, 'data/report-sources/rystad-upstream-test.xlsx'),
  research: resolve(repositoryRoot, 'data/report-sources/research-reports-test.xlsx'),
};
const outputPath = resolve(repositoryRoot, 'data/report-catalog.json');
const syncedOn = '2026-08-04';
const allowedInformationTypes = new Set([
  '年度综合报告',
  '财务报告',
  'ESG与可持续发展报告',
  '行业研究报告',
]);

const XLSX = await loadXlsx();
const rystadRows = await readFirstSheet(sourcePaths.rystad);
const researchRows = await readFirstSheet(sourcePaths.research);

const reports = [
  ...rystadRows.map((row) => ({
    id: idFor('rystad', row.data_id),
    sourceRecordId: clean(row.data_id),
    sourceFamily: '行业研究',
    title: required(row['中文标题'], 'Rystad 中文标题'),
    subtitle: nullable(row['英文标题']),
    summary: null,
    industry: required(row['行业'], 'Rystad 行业'),
    region: required(row['地区'], 'Rystad 地区'),
    informationType: '行业研究报告',
    publisher: required(row['发布机构'], 'Rystad 发布机构'),
    publishedOn: normalizeDate(row['发布时间']),
    language: nullable(row['英文标题']) ? '中英' : '中文',
    sourceFormat: '未提供',
    attachmentAvailable: false,
    keywords: splitValues(row['关键词']),
    relatedCompanyNames: [],
  })),
  ...researchRows.map((row) => {
    const informationType = required(row['资料类型'], '研究报告 资料类型');
    if (!allowedInformationTypes.has(informationType)) {
      throw new Error(`Unsupported information type: ${informationType}`);
    }
    return {
      id: idFor('research', row.data_id),
      sourceRecordId: clean(row.data_id),
      sourceFamily: informationType === '行业研究报告' ? '行业研究' : '公司披露',
      title: required(row['报告名'], '研究报告 报告名'),
      subtitle: null,
      summary: null,
      industry: required(row['行业'], '研究报告 行业'),
      region: '未标注',
      informationType,
      publisher: required(row['发布机构'], '研究报告 发布机构'),
      publishedOn: normalizeDate(row['发布日期']),
      language: '中文',
      sourceFormat: '未提供',
      attachmentAvailable: false,
      keywords: [],
      relatedCompanyNames: splitValues(row['关联公司']).filter((value) => value !== '-'),
    };
  }),
];

reports.sort((left, right) => {
  const dateOrder = (right.publishedOn ?? '').localeCompare(left.publishedOn ?? '');
  return dateOrder || left.title.localeCompare(right.title, 'zh-CN') || left.id.localeCompare(right.id);
});

const ids = reports.map(({ id }) => id);
const catalog = {
  schemaVersion: 1,
  syncedOn,
  sourceFiles: [
    { path: 'data/report-sources/rystad-upstream-test.xlsx', rows: rystadRows.length },
    { path: 'data/report-sources/research-reports-test.xlsx', rows: researchRows.length },
  ],
  quality: {
    totalRows: reports.length,
    blankTitles: reports.filter(({ title }) => !title).length,
    duplicateIds: ids.length - new Set(ids).size,
    missingPublicationDates: reports.filter(({ publishedOn }) => !publishedOn).length,
    missingRegions: reports.filter(({ region }) => region === '未标注').length,
    missingAttachments: reports.filter(({ attachmentAvailable }) => !attachmentAvailable).length,
  },
  reports,
};

validateCatalog(catalog);
const serialized = `${JSON.stringify(catalog, null, 2)}\n`;
if (process.argv.includes('--check')) {
  const existing = await readFile(outputPath, 'utf8').catch(() => '');
  if (existing !== serialized) {
    throw new Error('Report catalog is missing or stale. Run scripts/build-report-catalog.mjs.');
  }
} else {
  await writeFile(outputPath, serialized, 'utf8');
  console.log(`Wrote ${reports.length} normalized reports to data/report-catalog.json.`);
}

async function loadXlsx() {
  const vendorSource = await readFile(vendorPath, 'utf8');
  const sandbox = { ArrayBuffer, Buffer, console, Date, Uint8Array, setTimeout, clearTimeout };
  sandbox.global = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.self = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(vendorSource, sandbox, { filename: vendorPath });
  if (!sandbox.XLSX) throw new Error('Unable to initialize the bundled XLSX parser.');
  return sandbox.XLSX;
}

async function readFirstSheet(path) {
  const workbook = XLSX.read(await readFile(path), { type: 'buffer' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { defval: '', raw: false })
    .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [clean(key), value])))
    .filter((row) => Object.values(row).some((value) => clean(value)));
}

function clean(value) {
  return String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function required(value, label) {
  const normalized = clean(value);
  if (!normalized) throw new Error(`Missing ${label}.`);
  return normalized;
}

function nullable(value) {
  return clean(value) || null;
}

function idFor(source, value) {
  const id = required(value, `${source} data_id`).toLocaleLowerCase();
  if (!/^[a-f0-9]{24}$/.test(id)) throw new Error(`Invalid ${source} data_id: ${id}`);
  return `${source}-${id}`;
}

function splitValues(value) {
  return [...new Set(clean(value).split(/[,，;；|]+/).map(clean).filter(Boolean))];
}

function normalizeDate(value) {
  const text = clean(value);
  if (!text) return null;
  const iso = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`;
  const chinese = text.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (chinese) return `${chinese[1]}-${chinese[2].padStart(2, '0')}-${chinese[3].padStart(2, '0')}`;
  throw new Error(`Unsupported publication date: ${text}`);
}

function validateCatalog(value) {
  if (value.reports.length !== 1_111) throw new Error(`Expected 1,111 rows, got ${value.reports.length}.`);
  if (value.quality.duplicateIds) throw new Error('Duplicate report IDs detected.');
  for (const report of value.reports) {
    if (!allowedInformationTypes.has(report.informationType)) {
      throw new Error(`Invalid normalized information type: ${report.informationType}`);
    }
    if (!['公司披露', '行业研究'].includes(report.sourceFamily)) {
      throw new Error(`Invalid source family: ${report.sourceFamily}`);
    }
    if (report.attachmentAvailable) throw new Error(`Attachment incorrectly available: ${report.id}`);
  }
}
