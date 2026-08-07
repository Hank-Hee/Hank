import {
  CompanyDetailSchema,
  CompanySummarySchema,
  FidProjectSchema,
  type CompanyDetail,
  type FidProject,
  type CompanySlug,
  type CompanySummary,
  ReportDetailSchema,
  type ReportDetail,
  type RelatedInformation,
} from '@wison/contracts';
import { withDatabaseContext, type DatabaseBinding, type SqlClient } from '../auth/database-context';
import type { VerifiedIdentity } from '../auth/types';
import { englishReportTitle } from '../content/english-content';

type CompanyRow = {
  slug: string;
  source_id: string;
  display_name: string;
  company_type: string;
  country: string;
  region: string;
  business: string;
  market_position: string;
  website: string;
  founded_year: number;
  headquarters: string;
  project_count: number;
  country_count: number;
  updated_on: string;
  business_regions: string[];
  has_projects: boolean;
  has_complete_portfolio: boolean;
  has_news: boolean;
};
type RelatedRow = {
  id: string;
  kind: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  summary_en: string | null;
  publisher: string;
  published_on: string | null;
  source_format: string;
  attachment_available: boolean;
  news_category: string | null;
  region: string;
  source_url: string | null;
};
type FidRow = {
  id: string;
  project: string;
  approval_year: string | null;
  asset: string;
  field_type: string;
  facility_category: string;
  interests: string;
  country: string;
  economics_usd_million: string | number | null;
};
type ReportRow = {
  id: string;
  title: string;
  subtitle: string | null;
  summary: string | null;
  industry: string;
  region: string;
  information_type: string;
  source_family: string;
  publisher: string;
  published_on: string | null;
  language: string;
  source_format: string;
  attachment_available: boolean;
  keywords: string[];
  related_companies: Array<{ slug: string; displayName: string }>;
};

export interface CompanyRepository {
  list(identity: VerifiedIdentity, requestId: string): Promise<CompanySummary[]>;
  findBySlug(
    slug: CompanySlug,
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<CompanyDetail | null>;
  listReports(identity: VerifiedIdentity, requestId: string): Promise<{
    reports: ReportDetail[];
    syncedOn: string;
  }>;
  findReportById(
    id: string,
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<ReportDetail | null>;
  listCompanyInformation(
    slug: CompanySlug,
    kind: 'report' | 'news',
    page: number,
    pageSize: number,
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<{ information: RelatedInformation[]; total: number } | null>;
  listFidProjects(
    slug: CompanySlug,
    page: number,
    pageSize: number,
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<{ projects: FidProject[]; syncedOn: string; total: number } | null>;
}

function toSummary(row: CompanyRow): CompanySummary {
  return CompanySummarySchema.parse({
    slug: row.slug,
    displayName: row.display_name,
    companyType: row.company_type,
    country: row.country,
    region: row.region,
    business: row.business,
    marketPosition: row.market_position,
    headquarters: row.headquarters,
    projectCount: row.project_count,
    countryCount: row.country_count,
    dataCoverage: row.has_complete_portfolio ? 'complete' : row.has_projects ? 'projects' : 'profile',
    updatedOn: row.updated_on,
  });
}

function toRelatedInformation(item: RelatedRow): RelatedInformation {
  return {
    id: item.id,
    kind: item.kind as 'report' | 'news',
    title: item.title,
    subtitle: item.kind === 'report' ? englishReportTitle(item.id, item.subtitle) : item.subtitle,
    summary: item.summary,
    summaryEn: item.summary_en,
    publisher: item.publisher,
    publishedOn: item.published_on,
    sourceFormat: item.source_format,
    attachmentAvailable: item.attachment_available,
    category: item.news_category,
    region: item.region,
    sourceUrl: item.source_url,
  };
}

function toFidProject(row: FidRow): FidProject {
  return FidProjectSchema.parse({
    id: row.id,
    project: row.project,
    approvalYear: row.approval_year,
    asset: row.asset,
    fieldType: row.field_type,
    facilityCategory: row.facility_category,
    interests: row.interests,
    country: row.country,
    economicsUsdMillion: row.economics_usd_million === null ? null : Number(row.economics_usd_million),
  });
}

function dashboardUrls(slug: CompanySlug, displayName: string, assetKinds: Set<string>) {
  const operator = encodeURIComponent(displayName);
  const productionSlug = slug === 'exxonmobil' ? 'exxon' : slug;
  return {
    map: assetKinds.has('map-and-project-type')
      ? `/company-assets/maps/index.html?operator=${operator}` : null,
    projectType: assetKinds.has('map-and-project-type')
      ? `/company-assets/charts/project-type/index.html?operator=${operator}` : null,
    production: assetKinds.has('production-dashboard')
      ? `/company-assets/production/${productionSlug}.html` : null,
    financial: assetKinds.has('financial-dashboard')
      ? `/company-assets/financial/${slug}.html` : null,
  };
}

function toReport(row: ReportRow): ReportDetail {
  return ReportDetailSchema.parse({
    id: row.id,
    title: row.title,
    subtitle: englishReportTitle(row.id, row.subtitle),
    summary: row.summary,
    industry: row.industry,
    region: row.region,
    informationType: row.information_type,
    sourceFamily: row.source_family,
    publisher: row.publisher,
    publishedOn: row.published_on,
    language: row.language,
    sourceFormat: row.source_format,
    attachmentAvailable: row.attachment_available,
    keywords: row.keywords,
    relatedCompanies: row.related_companies,
    detailStatus: 'metadata-only',
  });
}

const companySelect = `select companies.slug, companies.source_id, companies.display_name,
  companies.company_type, companies.country, companies.region, companies.business,
  companies.market_position, companies.website, companies.founded_year, companies.headquarters,
  companies.project_count, companies.country_count, companies.business_regions,
  companies.updated_at::date::text as updated_on,
  exists (
    select 1 from app_private.company_assets asset
    where asset.company_slug = companies.slug
      and asset.kind = 'map-and-project-type' and asset.status = 'present'
  ) as has_projects,
  (
    select count(distinct asset.kind) = 5 from app_private.company_assets asset
    where asset.company_slug = companies.slug and asset.status = 'present'
      and asset.kind = any (array[
        'map-and-project-type', 'production-dashboard', 'production-data',
        'financial-dashboard', 'financial-data'
      ])
  ) as has_complete_portfolio
  , exists (
    select 1 from app_private.company_related_information relation
    join app_private.related_information information on information.id = relation.information_id
    where relation.company_slug = companies.slug and information.kind = 'news'
  ) as has_news
from app_private.companies companies`;

const reportSelect = `select information.id, information.title, information.subtitle,
  information.summary, information.industry, information.region, information.information_type,
  information.source_family, information.publisher, information.published_on::text, information.language,
  information.source_format, information.attachment_available, information.keywords,
  coalesce(
    json_agg(json_build_object('slug', companies.slug, 'displayName', companies.display_name)
      order by companies.display_name) filter (where companies.slug is not null),
    '[]'::json
  ) as related_companies
from app_private.related_information information
left join app_private.company_related_information relation
  on relation.information_id = information.id
left join app_private.companies companies on companies.slug = relation.company_slug`;

async function findCompany(client: SqlClient, slug: CompanySlug): Promise<CompanyRow | undefined> {
  const result = await client.query<CompanyRow>(
    `${companySelect} where companies.slug = $1`,
    [slug],
  );
  return result.rows[0];
}

export function createCompanyRepository(binding: DatabaseBinding): CompanyRepository {
  return {
    list(identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const result = await client.query<CompanyRow>(
          `${companySelect} order by companies.display_name`,
        );
        return result.rows.map(toSummary);
      });
    },
    findBySlug(slug, identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const row = await findCompany(client, slug);
        if (!row) return null;

        const assets = await client.query<{ kind: string }>(
            `select kind from app_private.company_assets
             where company_slug = $1 and status = 'present' order by kind`,
            [slug],
          );
        const assetKinds = new Set(assets.rows.map(({ kind }) => kind));
        return CompanyDetailSchema.parse({
          ...toSummary(row),
          sourceId: row.source_id,
          website: row.website,
          foundedYear: row.founded_year,
          businessRegions: row.business_regions,
          dashboards: dashboardUrls(slug, row.display_name, assetKinds),
          relatedInformation: [],
          newsStatus: row.has_news ? 'available' : 'not-provided',
        });
      });
    },
    listReports(identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const [result, sync] = await Promise.all([
          client.query<ReportRow>(
            `${reportSelect}
             where information.kind = 'report'
             group by information.id
             order by information.published_on desc nulls last, information.id`,
          ),
          client.query<{ synced_on: string }>(
            `select coalesce(max(synced_on), current_date)::text as synced_on
             from app_private.related_information where kind = 'report'`,
          ),
        ]);
        const syncedOn = sync.rows[0]?.synced_on;
        if (!syncedOn) throw new Error('Report synchronization date is unavailable.');
        return {
          reports: result.rows.map(toReport),
          syncedOn,
        };
      });
    },
    findReportById(id, identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const result = await client.query<ReportRow>(
          `${reportSelect}
           where information.kind = 'report' and information.id = $1
           group by information.id`,
          [id],
        );
        return result.rows[0] ? toReport(result.rows[0]) : null;
      });
    },
    listCompanyInformation(slug, kind, page, pageSize, identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const company = await findCompany(client, slug);
        if (!company) return null;
        const offset = (page - 1) * pageSize;
        const count = await client.query<{ total: number }>(
            `select count(*)::integer as total
             from app_private.company_related_information relation
             join app_private.related_information information on information.id = relation.information_id
             where relation.company_slug = $1 and information.kind = $2`,
            [slug, kind],
          );
        const result = await client.query<RelatedRow>(
            `select information.id, information.kind, information.title, information.subtitle,
              information.summary, information.summary_en, information.publisher,
              information.published_on::text, information.source_format,
              information.attachment_available, information.news_category,
              information.region, information.source_url
             from app_private.company_related_information relation
             join app_private.related_information information on information.id = relation.information_id
             where relation.company_slug = $1 and information.kind = $2
             order by information.published_on desc nulls last, information.id
             limit $3 offset $4`,
            [slug, kind, pageSize, offset],
          );
        return {
          information: result.rows.map(toRelatedInformation),
          total: count.rows[0]?.total ?? 0,
        };
      });
    },
    listFidProjects(slug, page, pageSize, identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const company = await findCompany(client, slug);
        if (!company) return null;
        const offset = (page - 1) * pageSize;
        const count = await client.query<{ total: number }>(
            `select count(*)::integer as total from app_private.fid_projects where company_slug = $1`,
            [slug],
          );
        const result = await client.query<FidRow>(
            `select id, project, approval_year, asset, field_type, facility_category,
              interests, country, economics_usd_million
             from app_private.fid_projects where company_slug = $1
             order by approval_year desc nulls last, project, id
             limit $2 offset $3`,
            [slug, pageSize, offset],
          );
        const sync = await client.query<{ synced_on: string }>(
            `select coalesce(max(synced_on), '2026-08-07'::date)::text as synced_on
             from app_private.fid_projects`,
          );
        return {
          projects: result.rows.map(toFidProject),
          syncedOn: sync.rows[0]?.synced_on ?? '2026-08-07',
          total: count.rows[0]?.total ?? 0,
        };
      });
    },
  };
}
