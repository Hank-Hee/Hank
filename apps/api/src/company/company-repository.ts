import {
  CompanyDetailSchema,
  CompanySummarySchema,
  type CompanyDetail,
  type CompanySlug,
  type CompanySummary,
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
};
type RelatedRow = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  source_name: string;
  published_on: string;
  source_format: string;
  attachment_available: boolean;
};

export interface CompanyRepository {
  list(identity: VerifiedIdentity, requestId: string): Promise<CompanySummary[]>;
  findBySlug(
    slug: CompanySlug,
    identity: VerifiedIdentity,
    requestId: string,
  ): Promise<CompanyDetail | null>;
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
  });
}

function dashboardUrls(slug: CompanySlug, displayName: string) {
  const operator = encodeURIComponent(displayName);
  const productionSlug = slug === 'exxonmobil' ? 'exxon' : slug;
  return {
    banner: `/company-assets/banners/${slug}.html`,
    map: `/company-assets/maps/index.html?operator=${operator}`,
    projectType: `/company-assets/charts/project-type/index.html?operator=${operator}`,
    production: `/company-assets/production/${productionSlug}.html`,
    financial: `/company-assets/financial/${slug}.html`,
  };
}

async function findCompany(client: SqlClient, slug: CompanySlug): Promise<CompanyRow | undefined> {
  const result = await client.query<CompanyRow>(
    `select slug, source_id, display_name, company_type, country, region, business,
      market_position, website, founded_year, headquarters, project_count,
      country_count, business_regions
    from app_private.companies where slug = $1`,
    [slug],
  );
  return result.rows[0];
}

export function createCompanyRepository(binding: DatabaseBinding): CompanyRepository {
  return {
    list(identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const result = await client.query<CompanyRow>(
          `select slug, source_id, display_name, company_type, country, region, business,
            market_position, website, founded_year, headquarters, project_count,
            country_count, business_regions
          from app_private.companies where is_featured order by display_name`,
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
              information.source_name, information.published_on::text,
              information.source_format, information.attachment_available
            from app_private.related_information information
            join app_private.company_related_information relation
              on relation.information_id = information.id
            where relation.company_slug = $1
            order by information.published_on desc, information.id`,
            [slug],
          ),
        ]);
        if (assets.rows.length !== 7) throw new Error('Company asset inventory is incomplete.');

        const relatedInformation: RelatedInformation[] = related.rows.map((item) => ({
          id: item.id,
          kind: item.kind as 'report' | 'news',
          title: item.title,
          summary: item.summary,
          sourceName: item.source_name,
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
          dashboards: dashboardUrls(slug, row.display_name),
          relatedInformation,
          newsStatus: 'not-provided',
        });
      });
    },
  };
}
