import {
  CompanyInformationListResponseSchema,
  CompanySlugSchema,
  FidProjectListResponseSchema,
} from '@wison/contracts';
import { Hono } from 'hono';
import { z } from 'zod';
import type { CompanyRepository } from '../company/company-repository';
import { AppError } from '../lib/app-error';
import { createKeyedReadThroughCache, createReadThroughCache } from '../lib/read-through-cache';
import type { AppEnvironment } from '../types';

export type CompanyRepositoryFactory = (bindings: AppEnvironment['Bindings']) => CompanyRepository;

const informationQuerySchema = z.object({
  kind: z.enum(['report', 'news']),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(6),
});
const fidQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

function publicCacheControl(context: { env?: { PUBLIC_READ_ONLY?: string } }) {
  return context.env?.PUBLIC_READ_ONLY === 'true'
    ? 'public, max-age=60, s-maxage=300, stale-while-revalidate=600'
    : 'private, max-age=60';
}

export const companyRoutes = (getRepository: CompanyRepositoryFactory) => {
  const routes = new Hono<AppEnvironment>();
  const readList = createReadThroughCache<string>();
  const readDetail = createKeyedReadThroughCache<string, Awaited<ReturnType<CompanyRepository['findBySlug']>>>();
  const readInformation = createKeyedReadThroughCache<string, Awaited<ReturnType<CompanyRepository['listCompanyInformation']>>>();
  const readFidProjects = createKeyedReadThroughCache<string, Awaited<ReturnType<CompanyRepository['listFidProjects']>>>();
  routes.get('/', async (context) => {
    context.header('cache-control', publicCacheControl(context));
    const companies = await readList(async () => JSON.stringify({
      companies: await getRepository(context.env).list(
        context.get('identity'), context.get('requestId'),
      ),
    }));
    return context.body(companies, 200, { 'content-type': 'application/json; charset=UTF-8' });
  });
  routes.get('/:slug/information', async (context) => {
    const slug = CompanySlugSchema.safeParse(context.req.param('slug'));
    const query = informationQuerySchema.safeParse(context.req.query());
    if (!slug.success) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    if (!query.success) throw new AppError('BAD_REQUEST', 400, 'Company information query is invalid.');
    const cacheKey = `${slug.data}:${query.data.kind}:${query.data.page}:${query.data.pageSize}`;
    const result = await readInformation(cacheKey, () => getRepository(context.env).listCompanyInformation(
      slug.data, query.data.kind, query.data.page, query.data.pageSize,
      context.get('identity'), context.get('requestId'),
    ));
    if (!result) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    context.header('cache-control', publicCacheControl(context));
    return context.json(CompanyInformationListResponseSchema.parse({
      ...result,
      kind: query.data.kind,
      page: query.data.page,
      pageSize: query.data.pageSize,
    }));
  });
  routes.get('/:slug/fid-projects', async (context) => {
    const slug = CompanySlugSchema.safeParse(context.req.param('slug'));
    const query = fidQuerySchema.safeParse(context.req.query());
    if (!slug.success) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    if (!query.success) throw new AppError('BAD_REQUEST', 400, 'FID query is invalid.');
    const cacheKey = `${slug.data}:${query.data.page}:${query.data.pageSize}`;
    const result = await readFidProjects(cacheKey, () => getRepository(context.env).listFidProjects(
      slug.data, query.data.page, query.data.pageSize,
      context.get('identity'), context.get('requestId'),
    ));
    if (!result) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    context.header('cache-control', publicCacheControl(context));
    return context.json(FidProjectListResponseSchema.parse({
      ...result,
      page: query.data.page,
      pageSize: query.data.pageSize,
    }));
  });
  routes.get('/:slug/logo', async (context) => {
    const slug = CompanySlugSchema.safeParse(context.req.param('slug'));
    if (!slug.success) throw new AppError('NOT_FOUND', 404, 'Company logo was not found.');
    const asset = await getRepository(context.env).findCompanyLogo(
      slug.data, context.get('identity'), context.get('requestId'),
    );
    if (!asset) throw new AppError('NOT_FOUND', 404, 'Company logo was not found.');
    const object = await context.env.FILES.get(asset.objectKey);
    if (!object) throw new AppError('NOT_FOUND', 404, 'Stored company logo was not found.');
    context.header('content-type', asset.mimeType);
    context.header('content-length', String(asset.byteSize));
    context.header('etag', object.etag);
    context.header('cache-control', 'public, max-age=86400, s-maxage=604800, immutable');
    return context.body(object.body);
  });
  routes.get('/:slug', async (context) => {
    const parsed = CompanySlugSchema.safeParse(context.req.param('slug'));
    if (!parsed.success) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    const company = await readDetail(parsed.data, () => getRepository(context.env).findBySlug(
      parsed.data, context.get('identity'), context.get('requestId'),
    ));
    if (!company) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    context.header('cache-control', publicCacheControl(context));
    return context.json(company);
  });
  return routes;
};
