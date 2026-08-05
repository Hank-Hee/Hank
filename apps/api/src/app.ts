import type { ApiErrorResponse } from '@wison/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createPermissionLoader } from './auth/permission-loader';
import { createEnvironmentTokenVerifier } from './auth/environment-token-verifier';
import { createCloudflareAccessVerifier } from './auth/cloudflare-access-verifier';
import { createCompanyRepository } from './company/company-repository';
import { resolveDatabaseBinding } from './db/environment-database-binding';
import { AppError } from './lib/app-error';
import { authentication, type AuthServicesFactory } from './middleware/authentication';
import { requestIdMiddleware } from './middleware/request-id';
import { requirePermission } from './middleware/require-permission';
import { isPublicReadRequest, readOnlyAccess } from './middleware/read-only-access';
import { healthRoutes } from './routes/health';
import { companyRoutes, type CompanyRepositoryFactory } from './routes/companies';
import { demoSessionRoutes } from './routes/demo-session';
import { meRoutes } from './routes/me';
import { reportRoutes } from './routes/reports';
import type { AppEnvironment } from './types';

const createDefaultAuthServices: AuthServicesFactory = (bindings) => {
  const hasAccessBinding = Boolean(
    bindings.CLOUDFLARE_ACCESS_AUD || bindings.CLOUDFLARE_ACCESS_ALLOWED_EMAILS
      || bindings.CLOUDFLARE_ACCESS_TEAM_DOMAIN,
  );
  if (hasAccessBinding && !(bindings.CLOUDFLARE_ACCESS_AUD && bindings.CLOUDFLARE_ACCESS_ALLOWED_EMAILS && bindings.CLOUDFLARE_ACCESS_TEAM_DOMAIN)) {
    throw new Error('Cloudflare Access requires the team domain, application audience, and email allowlist.');
  }
  return {
    accessVerifier: hasAccessBinding ? createCloudflareAccessVerifier({
      CLOUDFLARE_ACCESS_AUD: bindings.CLOUDFLARE_ACCESS_AUD!,
      CLOUDFLARE_ACCESS_ALLOWED_EMAILS: bindings.CLOUDFLARE_ACCESS_ALLOWED_EMAILS!,
      CLOUDFLARE_ACCESS_TEAM_DOMAIN: bindings.CLOUDFLARE_ACCESS_TEAM_DOMAIN!,
    }) : undefined,
    loader: createPermissionLoader(resolveDatabaseBinding(bindings)),
    verifier: createEnvironmentTokenVerifier(bindings),
  };
};
const createDefaultCompanyRepository: CompanyRepositoryFactory = (bindings) =>
  createCompanyRepository(resolveDatabaseBinding(bindings));

const dashboardContentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "frame-ancestors 'self'",
  "object-src 'none'",
  "connect-src 'self'",
  "img-src 'self' data: https://*.basemaps.cartocdn.com",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
].join('; ');

export function createApp(
  getAuthServices: AuthServicesFactory = createDefaultAuthServices,
  getCompanyRepository: CompanyRepositoryFactory = createDefaultCompanyRepository,
): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());

  app.route('/api/v1/health', healthRoutes);
  app.route('/api/v1/demo/session', demoSessionRoutes);

  const protectedMe = new Hono<AppEnvironment>();
  protectedMe.use('*', authentication(getAuthServices));
  protectedMe.use('*', requirePermission('platform.access'));
  protectedMe.route('/', meRoutes);
  app.route('/api/v1/me', protectedMe);

  const readableCompanies = new Hono<AppEnvironment>();
  readableCompanies.use('*', readOnlyAccess(getAuthServices));
  readableCompanies.use('*', async (context, next) => {
    if (!isPublicReadRequest(context.env, context.req.method)) return requirePermission('platform.access')(context, next);
    await next();
  });
  readableCompanies.route('/', companyRoutes(getCompanyRepository));
  app.route('/api/v1/companies', readableCompanies);

  const readableReports = new Hono<AppEnvironment>();
  readableReports.use('*', readOnlyAccess(getAuthServices));
  readableReports.use('*', async (context, next) => {
    if (!isPublicReadRequest(context.env, context.req.method)) return requirePermission('platform.access')(context, next);
    await next();
  });
  readableReports.route('/', reportRoutes(getCompanyRepository));
  app.route('/api/v1/reports', readableReports);

  app.use('/company-assets/*', readOnlyAccess(getAuthServices));
  app.use('/company-assets/*', async (context, next) => {
    if (!isPublicReadRequest(context.env, context.req.method)) return requirePermission('platform.access')(context, next);
    await next();
  });
  app.get('/company-assets/*', async (context) => {
    const asset = await context.env.ASSETS.fetch(context.req.raw);
    const headers = new Headers(asset.headers);
    headers.set('content-security-policy', dashboardContentSecurityPolicy);
    headers.set(
      'cache-control',
      isPublicReadRequest(context.env, context.req.method)
        ? 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400'
        : 'private, max-age=60',
    );
    return new Response(asset.body, {
      status: asset.status,
      statusText: asset.statusText,
      headers,
    });
  });

  app.notFound((context) => {
    const response: ApiErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: 'The requested API route does not exist.',
        requestId: context.get('requestId'),
      },
    };
    return context.json(response, 404);
  });

  app.onError((error, context) => {
    if (!(error instanceof AppError)) {
      console.error('Unhandled application error', {
        requestId: context.get('requestId'),
        error,
      });
    }
    const appError = error instanceof AppError
      ? error
      : new AppError('INTERNAL_ERROR', 500, 'An unexpected error occurred.');

    const response: ApiErrorResponse = {
      error: {
        code: appError.code,
        message: appError.message,
        requestId: context.get('requestId'),
      },
    };
    context.header('x-request-id', context.get('requestId'));
    return context.json(response, appError.status);
  });

  return app;
}
