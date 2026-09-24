import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const options = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(await readFile(requiredPath(options, '--manifest'), 'utf8'));
const outputPath = requiredPath(options, '--output');
const mode = options.get('--mode') ?? 'replace-all';
if (!['replace-all', 'replace-covers'].includes(mode)) throw new Error(`Unsupported sync mode: ${mode}`);
const reportAssets = manifest.reportAssets.map((asset) => ({
  report_id: asset.reportId,
  id: asset.id,
  kind: asset.kind,
  original_file_name: asset.originalFileName,
  object_key: asset.objectKey,
  source_object_key: asset.sourceObjectKey,
  sha256: asset.sha256,
  source_sha256: asset.sourceSha256,
  mime_type: asset.mimeType,
  byte_size: asset.byteSize,
  rights_type: asset.rightsType,
  security_level: asset.securityLevel,
  review_status: asset.reviewStatus,
}));
const companyLogos = manifest.companyLogos.map((asset) => ({
  company_slug: asset.companySlug,
  object_key: asset.objectKey,
  sha256: asset.sha256,
  mime_type: asset.mimeType,
  byte_size: asset.byteSize,
}));
if (mode === 'replace-covers' && (reportAssets.some(({ kind }) => kind !== 'cover') || companyLogos.length)) {
  throw new Error('replace-covers mode only accepts report cover assets and no company logos.');
}
const reportJson = dollarQuotedJson('report_assets', reportAssets);
const logoJson = dollarQuotedJson('company_logos', companyLogos);
const coverReportIds = [...new Set(reportAssets.map(({ report_id }) => report_id))];
const coverReportIdsJson = dollarQuotedJson('cover_report_ids', coverReportIds);
const deletionSql = mode === 'replace-covers'
  ? `delete from app_private.report_assets
where kind = 'cover'
  and report_id in (select value from jsonb_array_elements_text(${coverReportIdsJson}::jsonb));`
  : `delete from app_private.report_assets;
delete from app_private.company_brand_assets;`;
const logoInsertSql = mode === 'replace-covers' ? '' : `
insert into app_private.company_brand_assets (company_slug, object_key, sha256, mime_type, byte_size)
select company_slug, object_key, sha256, mime_type, byte_size
from jsonb_to_recordset(${logoJson}::jsonb) as asset(
  company_slug text, object_key text, sha256 text, mime_type text, byte_size bigint
);
`;
const verificationSql = mode === 'replace-covers'
  ? `select count(*) into actual_covers
  from app_private.report_assets
  where kind = 'cover'
    and report_id in (select value from jsonb_array_elements_text(${coverReportIdsJson}::jsonb));
  if actual_covers <> ${reportAssets.length} then
    raise exception 'Report cover verification failed: expected %, actual %',
      ${reportAssets.length}, actual_covers;
  end if;`
  : `select count(*) into actual_attachments from app_private.report_assets where kind = 'attachment';
  select count(*) into actual_covers from app_private.report_assets where kind = 'cover';
  select count(*) into actual_logos from app_private.company_brand_assets;
  if actual_attachments <> ${reportAssets.filter(({ kind }) => kind === 'attachment').length}
    or actual_covers <> ${reportAssets.filter(({ kind }) => kind === 'cover').length}
    or actual_logos <> ${companyLogos.length} then
    raise exception 'Report asset verification failed: attachments %, covers %, logos %',
      actual_attachments, actual_covers, actual_logos;
  end if;`;
const sql = `begin;

${deletionSql}

insert into app_private.report_assets (
  report_id, id, kind, original_file_name, object_key, source_object_key,
  sha256, source_sha256, mime_type, byte_size, rights_type, security_level, review_status
)
select report_id, id, kind, original_file_name, object_key, source_object_key,
  sha256, source_sha256, mime_type, byte_size, rights_type, security_level, review_status
from jsonb_to_recordset(${reportJson}::jsonb) as asset(
  report_id text, id text, kind text, original_file_name text, object_key text,
  source_object_key text, sha256 text, source_sha256 text, mime_type text,
  byte_size bigint, rights_type text, security_level text, review_status text
);
${logoInsertSql}

do $verification$
declare
  actual_attachments integer;
  actual_covers integer;
  actual_logos integer;
begin
  ${verificationSql}
end
$verification$;

commit;
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, sql);
console.log(JSON.stringify({ output: outputPath, mode, reportAssets: reportAssets.length, companyLogos: companyLogos.length }));

function dollarQuotedJson(tag, value) {
  const json = JSON.stringify(value);
  const delimiter = `$${tag}$`;
  if (json.includes(delimiter)) throw new Error(`Generated JSON conflicts with SQL delimiter ${delimiter}.`);
  return `${delimiter}${json}${delimiter}`;
}

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
