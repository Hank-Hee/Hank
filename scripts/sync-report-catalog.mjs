import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const catalog = JSON.parse(
  await readFile(resolve(repositoryRoot, 'data/report-catalog.json'), 'utf8'),
);
const connectionString = withPassword(
  process.env.DATABASE_URL,
  process.env.DATABASE_PASSWORD,
);
const client = new pg.Client({ connectionString, ssl: shouldUseTls(connectionString) ? { rejectUnauthorized: false } : undefined });

await client.connect();
try {
  await client.query('begin');
  const companies = await client.query('select slug, display_name from app_private.companies');
  const companyByName = new Map(companies.rows.map(({ slug, display_name: displayName }) => [normalize(displayName), slug]));
  const relationships = catalog.reports.flatMap((report) =>
    report.relatedCompanyNames.flatMap((name) => {
      const companySlug = companyByName.get(normalize(name));
      return companySlug ? [{ companySlug, informationId: report.id }] : [];
    }),
  );

  await client.query(
    `delete from app_private.company_related_information where information_id in (
       select id from app_private.related_information where kind = 'report'
     )`,
  );
  await client.query(
    `insert into app_private.related_information (
       id, kind, title, subtitle, summary, industry, region, information_type, source_family,
       publisher, published_on, language, source_format, attachment_available, keywords,
       source_record_id, synced_on
     )
     select id, 'report', title, subtitle, summary, industry, region, information_type,
       source_family, publisher, published_on, language, source_format, false, keywords,
       source_record_id, synced_on
     from jsonb_to_recordset($1::jsonb) as report(
       id text, title text, subtitle text, summary text, industry text, region text,
       information_type text, source_family text, publisher text, published_on date,
       language text, source_format text, keywords text[], source_record_id text, synced_on date
     )
     on conflict (id) do update set
       title = excluded.title,
       subtitle = excluded.subtitle,
       summary = excluded.summary,
       industry = excluded.industry,
       region = excluded.region,
       information_type = excluded.information_type,
       source_family = excluded.source_family,
       publisher = excluded.publisher,
       published_on = excluded.published_on,
       language = excluded.language,
       source_format = excluded.source_format,
       keywords = excluded.keywords,
       source_record_id = excluded.source_record_id,
       synced_on = excluded.synced_on`,
    [JSON.stringify(catalog.reports.map((report) => ({
      id: report.id,
      title: report.title,
      subtitle: report.subtitle,
      summary: report.summary,
      industry: report.industry,
      region: report.region,
      information_type: report.informationType,
      source_family: report.sourceFamily,
      publisher: report.publisher,
      published_on: report.publishedOn,
      language: report.language,
      source_format: report.sourceFormat,
      keywords: report.keywords,
      source_record_id: report.sourceRecordId,
      synced_on: catalog.syncedOn,
    })))],
  );
  await client.query(
    `delete from app_private.related_information
     where kind = 'report' and not (id = any($1::text[]))`,
    [catalog.reports.map(({ id }) => id)],
  );
  if (relationships.length) {
    await client.query(
      `insert into app_private.company_related_information (company_slug, information_id)
       select company_slug, information_id
       from jsonb_to_recordset($1::jsonb) as relation(company_slug text, information_id text)
       on conflict do nothing`,
      [JSON.stringify(relationships.map(({ companySlug, informationId }) => ({
        company_slug: companySlug,
        information_id: informationId,
      })))],
    );
  }

  const verification = await client.query(
    `select
       count(*)::integer as report_count,
       count(*) filter (where attachment_available)::integer as available_attachments,
       max(synced_on)::text as synced_on
     from app_private.related_information where kind = 'report'`,
  );
  const relationCount = await client.query(
    `select count(*)::integer as relation_count from app_private.company_related_information`,
  );
  const result = { ...verification.rows[0], ...relationCount.rows[0] };
  if (result.report_count !== catalog.reports.length || result.synced_on !== catalog.syncedOn) {
    throw new Error(`Remote verification failed: ${JSON.stringify(result)}`);
  }
  await client.query('commit');
  console.log(JSON.stringify(result));
} catch (error) {
  await client.query('rollback').catch(() => undefined);
  throw error;
} finally {
  await client.end();
}

function normalize(value) {
  return String(value).trim().toLocaleLowerCase('en-US');
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
