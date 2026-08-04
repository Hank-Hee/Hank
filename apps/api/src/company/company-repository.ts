import {
  CompanyDetailSchema,
  CompanySummarySchema,
  type CompanyDetail,
  type CompanySlug,
  type CompanySummary,
  ReportDetailSchema,
  ReportListResponseSchema,
  type ReportDetail,
  type ReportListResponse,
  type RelatedInformation,
} from '@wison/contracts';
import { withDatabaseContext, type DatabaseBinding, type SqlClient } from '../auth/database-context';
import type { VerifiedIdentity } from '../auth/types';

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
  business_regions: string[];
  has_projects: boolean;
  has_complete_portfolio: boolean;
};
type RelatedRow = {
  id: string;
  kind: string;
  title: string;
  summary: string | null;
  publisher: string;
  published_on: string | null;
  source_format: string;
  attachment_available: boolean;
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
  listReports(identity: VerifiedIdentity, requestId: string): Promise<ReportListResponse>;
  findReportById(
    id: string,
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<ReportDetail | null>;
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
    subtitle: row.subtitle,
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

        const [assets, related] = await Promise.all([
          client.query<{ kind: string }>(
            `select kind from app_private.company_assets
             where company_slug = $1 and status = 'present' order by kind`,
            [slug],
          ),
          client.query<RelatedRow>(
            `select information.id, information.kind, information.title, information.summary,
              information.publisher, information.published_on::text,
              information.source_format, information.attachment_available
            from app_private.related_information information
            join app_private.company_related_information relation
              on relation.information_id = information.id
            where relation.company_slug = $1
            order by information.published_on desc, information.id`,
            [slug],
          ),
        ]);
        const assetKinds = new Set(assets.rows.map(({ kind }) => kind));

        const relatedInformation: RelatedInformation[] = related.rows.map((item) => ({
          id: item.id,
          kind: item.kind as 'report' | 'news',
          title: item.title,
          summary: item.summary,
          publisher: item.publisher,
          publishedOn: item.published_on,
          sourceFormat: item.source_format,
          attachmentAvailable: item.attachment_available,
        }));
        return CompanyDetailSchema.parse({
          ...toSummary(row),
          sourceId: row.source_id,
          website: row.website,
          foundedYear: row.founded_year,
          businessRegions: row.business_regions,
          dashboards: dashboardUrls(slug, row.display_name, assetKinds),
          relatedInformation,
          newsStatus: 'not-provided',
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
        return ReportListResponseSchema.parse({
          reports: result.rows.map(toReport),
          syncedOn: sync.rows[0]?.synced_on,
        });
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
  };
}
