import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';

const options = parseArguments(process.argv.slice(2));
const manifest = JSON.parse(await readFile(requiredPath(options, '--manifest'), 'utf8'));
const connectionString = withPassword(process.env.DATABASE_URL, process.env.DATABASE_PASSWORD);
const client = new pg.Client({
  connectionString,
  ssl: shouldUseTls(connectionString) ? { rejectUnauthorized: false } : undefined,
});

await client.connect();
try {
  await client.query('begin');
  const reportIds = [...new Set(manifest.reportAssets.map(({ reportId }) => reportId))];
  const companySlugs = manifest.companyLogos.map(({ companySlug }) => companySlug);
  const knownReports = await client.query(
    `select id from app_private.related_information where kind = 'report' and id = any($1::text[])`,
    [reportIds],
  );
  const knownCompanies = await client.query(
    `select slug from app_private.companies where slug = any($1::text[])`,
    [companySlugs],
  );
  if (knownReports.rows.length !== reportIds.length) throw new Error('Manifest contains unknown report IDs.');
  if (knownCompanies.rows.length !== companySlugs.length) throw new Error('Manifest contains unknown company slugs.');

  if (options.has('--replace')) {
    await client.query('delete from app_private.report_assets');
    await client.query('delete from app_private.company_brand_assets');
  }
  if (manifest.reportAssets.length) {
    await client.query(
      `insert into app_private.report_assets (
         report_id, id, kind, original_file_name, object_key, source_object_key,
         sha256, source_sha256, mime_type, byte_size, rights_type, security_level, review_status
       )
       select report_id, id, kind, original_file_name, object_key, source_object_key,
         sha256, source_sha256, mime_type, byte_size, rights_type, security_level, review_status
       from jsonb_to_recordset($1::jsonb) as asset(
         report_id text, id text, kind text, original_file_name text, object_key text,
         source_object_key text, sha256 text, source_sha256 text, mime_type text,
         byte_size bigint, rights_type text, security_level text, review_status text
       )
       on conflict (report_id, id) do update set
         original_file_name = excluded.original_file_name,
         object_key = excluded.object_key,
         source_object_key = excluded.source_object_key,
         sha256 = excluded.sha256,
         source_sha256 = excluded.source_sha256,
         mime_type = excluded.mime_type,
         byte_size = excluded.byte_size,
         rights_type = excluded.rights_type,
         security_level = excluded.security_level,
         review_status = excluded.review_status`,
      [JSON.stringify(manifest.reportAssets.map((asset) => ({
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
      })))],
    );
  }
  if (manifest.companyLogos.length) {
    await client.query(
      `insert into app_private.company_brand_assets (
         company_slug, object_key, sha256, mime_type, byte_size
       )
       select company_slug, object_key, sha256, mime_type, byte_size
       from jsonb_to_recordset($1::jsonb) as asset(
         company_slug text, object_key text, sha256 text, mime_type text, byte_size bigint
       )
       on conflict (company_slug) do update set
         object_key = excluded.object_key,
         sha256 = excluded.sha256,
         mime_type = excluded.mime_type,
         byte_size = excluded.byte_size,
         uploaded_at = now()`,
      [JSON.stringify(manifest.companyLogos.map((asset) => ({
        company_slug: asset.companySlug,
        object_key: asset.objectKey,
        sha256: asset.sha256,
        mime_type: asset.mimeType,
        byte_size: asset.byteSize,
      })))],
    );
  }
  const verification = await client.query(
    `select
       (select count(*)::integer from app_private.report_assets where kind = 'attachment') as attachment_relations,
       (select count(*)::integer from app_private.report_assets where kind = 'cover') as cover_relations,
       (select count(*)::integer from app_private.company_brand_assets) as company_logos,
       (select count(*)::integer from app_private.related_information
         where kind = 'report' and attachment_available) as reports_with_attachments`,
  );
  await client.query('commit');
  console.log(JSON.stringify(verification.rows[0]));
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

function parseArguments(values) {
  const parsed = new Map();
  for (const value of values) {
    if (value === '--replace') { parsed.set(value, 'true'); continue; }
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
function withPassword(rawUrl, password) {
  if (!rawUrl) throw new Error('DATABASE_URL is required.');
  const url = new URL(rawUrl);
  if (!url.password && password) url.password = password;
  if (!url.password && url.hostname !== '127.0.0.1' && url.hostname !== 'localhost') {
    throw new Error('DATABASE_PASSWORD is required for a remote database URL.');
  }
  return url.toString();
}
function shouldUseTls(url) {
  const hostname = new URL(url).hostname;
  return hostname !== '127.0.0.1' && hostname !== 'localhost';
}
