import { ReportListResponseSchema, type ReportSummary } from '@wison/contracts';
import { z } from 'zod';
import { Hono, type Context } from 'hono';
import type { CompanyRepository, StoredAssetReference } from '../company/company-repository';
import { AppError } from '../lib/app-error';
import { createKeyedReadThroughCache, createReadThroughCache } from '../lib/read-through-cache';
import type { AppEnvironment } from '../types';

const ReportIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);
const AssetIdSchema = z.string().regex(/^[a-f0-9]{24}$/);
const ReportQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  q: z.string().trim().max(200).optional().default(''),
  industry: z.string().trim().max(100).optional().default(''),
  region: z.string().trim().max(100).optional().default(''),
  informationType: z.string().trim().max(100).optional().default(''),
  sourceFamily: z.string().trim().max(100).optional().default(''),
  publisher: z.string().trim().max(200).optional().default(''),
});

function normalize(value: string) {
  return value.toLocaleLowerCase();
}

function matches(report: ReportSummary, query: z.infer<typeof ReportQuerySchema>) {
  const term = normalize(query.q);
  return (!term || [
    report.title,
    report.subtitle ?? '',
    report.summary ?? '',
    report.industry,
    report.region,
    report.publisher,
    ...report.keywords,
    ...report.relatedCompanies.map(({ displayName }) => displayName),
  ].some((value) => normalize(value).includes(term)))
    && (!query.industry || report.industry === query.industry)
    && (!query.region || report.region === query.region)
    && (!query.informationType || report.informationType === query.informationType)
    && (!query.sourceFamily || report.sourceFamily === query.sourceFamily)
    && (!query.publisher || report.publisher === query.publisher);
}

const distinctSorted = (values: string[]) => [...new Set(values)].sort((left, right) => left.localeCompare(right));

export const reportRoutes = (getRepository: (bindings: AppEnvironment['Bindings']) => CompanyRepository) => {
  const routes = new Hono<AppEnvironment>();
  const readCatalog = createReadThroughCache<Awaited<ReturnType<CompanyRepository['listReports']>>>();
  const readDetail = createKeyedReadThroughCache<string, Awaited<ReturnType<CompanyRepository['findReportById']>>>();
  routes.get('/', async (context) => {
    const parsed = ReportQuerySchema.safeParse(context.req.query());
    if (!parsed.success) throw new AppError('BAD_REQUEST', 400, 'Report query parameters are invalid.');
    const catalog = await readCatalog(() => getRepository(context.env).listReports(
      context.get('identity'), context.get('requestId'),
    ));
    const filtered = catalog.reports.filter((report) => matches(report, parsed.data));
    const start = (parsed.data.page - 1) * parsed.data.pageSize;
    const response = ReportListResponseSchema.parse({
      reports: filtered.slice(start, start + parsed.data.pageSize),
      syncedOn: catalog.syncedOn,
      total: filtered.length,
      page: parsed.data.page,
      pageSize: parsed.data.pageSize,
      facets: {
        industries: distinctSorted(catalog.reports.map(({ industry }) => industry)),
        regions: distinctSorted(catalog.reports.map(({ region }) => region)),
        informationTypes: distinctSorted(catalog.reports.map(({ informationType }) => informationType)),
        sourceFamilies: distinctSorted(catalog.reports.map(({ sourceFamily }) => sourceFamily)),
        publishers: distinctSorted(catalog.reports.map(({ publisher }) => publisher)),
      },
    });
    context.header('cache-control', context.env?.PUBLIC_READ_ONLY === 'true'
      ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
      : 'private, max-age=60');
    return context.json(response);
  });
  routes.get('/:id/cover', async (context) => {
    const reportId = ReportIdSchema.safeParse(context.req.param('id'));
    if (!reportId.success) throw new AppError('NOT_FOUND', 404, 'Report cover was not found.');
    const asset = await getRepository(context.env).findReportAsset(
      reportId.data, 'cover', null, context.get('identity'), context.get('requestId'),
    );
    if (!asset) throw new AppError('NOT_FOUND', 404, 'Report cover was not found.');
    return streamR2Asset(context, asset, false);
  });
  routes.get('/:id/attachments/:assetId', async (context) => {
    const reportId = ReportIdSchema.safeParse(context.req.param('id'));
    const assetId = AssetIdSchema.safeParse(context.req.param('assetId'));
    if (!reportId.success || !assetId.success) throw new AppError('NOT_FOUND', 404, 'Report attachment was not found.');
    const asset = await getRepository(context.env).findReportAsset(
      reportId.data, 'attachment', assetId.data, context.get('identity'), context.get('requestId'),
    );
    if (!asset) throw new AppError('NOT_FOUND', 404, 'Report attachment was not found.');
    return streamR2Asset(context, asset, true);
  });
  routes.get('/:id', async (context) => {
    const parsed = ReportIdSchema.safeParse(context.req.param('id'));
    if (!parsed.success) throw new AppError('NOT_FOUND', 404, 'Report was not found.');
    const report = await readDetail(parsed.data, () => getRepository(context.env).findReportById(
      parsed.data, context.get('identity'), context.get('requestId'),
    ));
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report was not found.');
    context.header('cache-control', context.env?.PUBLIC_READ_ONLY === 'true'
      ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
      : 'private, max-age=60');
    return context.json(report);
  });
  return routes;
};

async function streamR2Asset(
  context: Context<AppEnvironment>,
  asset: StoredAssetReference,
  download: boolean,
) {
  const object = await context.env.FILES.get(asset.objectKey);
  if (!object) throw new AppError('NOT_FOUND', 404, 'Stored report asset was not found.');
  context.header('content-type', asset.mimeType);
  context.header('content-length', String(asset.byteSize));
  context.header('etag', object.etag);
  context.header('cache-control', download
    ? 'public, max-age=300, s-maxage=3600'
    : 'public, max-age=86400, s-maxage=604800, immutable');
  if (download) context.header('content-disposition', contentDisposition(asset.fileName));
  return context.body(object.body);
}

function contentDisposition(fileName: string) {
  const fallback = fileName.replace(/[^A-Za-z0-9._-]+/gu, '_').slice(0, 160) || 'download';
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}
