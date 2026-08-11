import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const options = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(await readFile(requiredPath(options, '--manifest'), 'utf8'));
const outputPath = requiredPath(options, '--output');
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
const reportJson = dollarQuotedJson('report_assets', reportAssets);
const logoJson = dollarQuotedJson('company_logos', companyLogos);
const sql = `begin;

delete from app_private.report_assets;
delete from app_private.company_brand_assets;

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

insert into app_private.company_brand_assets (company_slug, object_key, sha256, mime_type, byte_size)
select company_slug, object_key, sha256, mime_type, byte_size
from jsonb_to_recordset(${logoJson}::jsonb) as asset(
  company_slug text, object_key text, sha256 text, mime_type text, byte_size bigint
);

do $verification$
declare
  actual_attachments integer;
  actual_covers integer;
  actual_logos integer;
begin
  select count(*) into actual_attachments from app_private.report_assets where kind = 'attachment';
  select count(*) into actual_covers from app_private.report_assets where kind = 'cover';
  select count(*) into actual_logos from app_private.company_brand_assets;
  if actual_attachments <> ${reportAssets.filter(({ kind }) => kind === 'attachment').length}
    or actual_covers <> ${reportAssets.filter(({ kind }) => kind === 'cover').length}
    or actual_logos <> ${companyLogos.length} then
    raise exception 'Report asset verification failed: attachments %, covers %, logos %',
      actual_attachments, actual_covers, actual_logos;
  end if;
end
$verification$;

commit;
`;

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, sql);
console.log(JSON.stringify({ output: outputPath, reportAssets: reportAssets.length, companyLogos: companyLogos.length }));

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
