import { z } from 'zod';
import { Hono } from 'hono';
import type { CompanyRepository } from '../company/company-repository';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

const ReportIdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(160);

export const reportRoutes = (getRepository: (bindings: AppEnvironment['Bindings']) => CompanyRepository) => {
  const routes = new Hono<AppEnvironment>();
  routes.get('/', async (context) => {
    const reports = await getRepository(context.env).listReports(
      context.get('identity'),
      context.get('requestId'),
    );
    context.header('cache-control', 'private, max-age=60');
    return context.json({ reports });
  });
  routes.get('/:id', async (context) => {
    const parsed = ReportIdSchema.safeParse(context.req.param('id'));
    if (!parsed.success) throw new AppError('NOT_FOUND', 404, 'Report was not found.');
    const report = await getRepository(context.env).findReportById(
      parsed.data,
      context.get('identity'),
      context.get('requestId'),
    );
    if (!report) throw new AppError('NOT_FOUND', 404, 'Report was not found.');
    context.header('cache-control', 'private, max-age=60');
    return context.json(report);
  });
  return routes;
};
