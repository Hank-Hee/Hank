import { CompanySlugSchema } from '@wison/contracts';
import { Hono } from 'hono';
import type { CompanyRepository } from '../company/company-repository';
import { AppError } from '../lib/app-error';
import { createKeyedReadThroughCache, createReadThroughCache } from '../lib/read-through-cache';
import type { AppEnvironment } from '../types';

export type CompanyRepositoryFactory = (bindings: AppEnvironment['Bindings']) => CompanyRepository;

export const companyRoutes = (getRepository: CompanyRepositoryFactory) => {
  const routes = new Hono<AppEnvironment>();
  const readList = createReadThroughCache<string>();
  const readDetail = createKeyedReadThroughCache<string, Awaited<ReturnType<CompanyRepository['findBySlug']>>>();
  routes.get('/', async (context) => {
    context.header('cache-control', 'private, max-age=60');
    const companies = await readList(async () => JSON.stringify({
      companies: await getRepository(context.env).list(
        context.get('identity'), context.get('requestId'),
      ),
    }));
    return context.body(companies, 200, { 'content-type': 'application/json; charset=UTF-8' });
  });
  routes.get('/:slug', async (context) => {
    const parsed = CompanySlugSchema.safeParse(context.req.param('slug'));
    if (!parsed.success) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    const company = await readDetail(parsed.data, () => getRepository(context.env).findBySlug(
      parsed.data, context.get('identity'), context.get('requestId'),
    ));
    if (!company) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    context.header('cache-control', 'private, max-age=60');
    return context.json(company);
  });
  return routes;
};
