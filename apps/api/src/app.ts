import type { ApiErrorResponse } from '@wison/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { createPermissionLoader } from './auth/permission-loader';
import { createTokenVerifier } from './auth/jwt-verifier';
import { AppError } from './lib/app-error';
import { authentication, type AuthServicesFactory } from './middleware/authentication';
import { requestIdMiddleware } from './middleware/request-id';
import { requirePermission } from './middleware/require-permission';
import { healthRoutes } from './routes/health';
import { meRoutes } from './routes/me';
import type { AppEnvironment } from './types';

const createDefaultAuthServices: AuthServicesFactory = (bindings) => ({
  loader: createPermissionLoader(bindings.HYPERDRIVE),
  verifier: createTokenVerifier(bindings),
});

export function createApp(
  getAuthServices: AuthServicesFactory = createDefaultAuthServices,
): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());

  app.route('/api/v1/health', healthRoutes);

  const protectedMe = new Hono<AppEnvironment>();
  protectedMe.use('*', authentication(getAuthServices));
  protectedMe.use('*', requirePermission('platform.access'));
  protectedMe.route('/', meRoutes);
  app.route('/api/v1/me', protectedMe);

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
