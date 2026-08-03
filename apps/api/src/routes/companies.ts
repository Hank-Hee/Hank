import { CompanySlugSchema } from '@wison/contracts';
import { Hono } from 'hono';
import type { CompanyRepository } from '../company/company-repository';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

export type CompanyRepositoryFactory = (bindings: AppEnvironment['Bindings']) => CompanyRepository;

export const companyRoutes = (getRepository: CompanyRepositoryFactory) => {
  const routes = new Hono<AppEnvironment>();
  routes.get('/', async (context) => {
    context.header('cache-control', 'private, max-age=60');
    const companies = await getRepository(context.env).list(
      context.get('identity'),
      context.get('requestId'),
    );
    return context.json({ companies });
  });
  routes.get('/:slug', async (context) => {
    const parsed = CompanySlugSchema.safeParse(context.req.param('slug'));
    if (!parsed.success) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    const company = await getRepository(context.env).findBySlug(
      parsed.data,
      context.get('identity'),
      context.get('requestId'),
    );
    if (!company) throw new AppError('NOT_FOUND', 404, 'Company was not found.');
    context.header('cache-control', 'private, max-age=60');
    return context.json(company);
  });
  return routes;
};
