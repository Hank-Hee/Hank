import type { ApiErrorResponse } from '@wison/contracts';
import { Hono } from 'hono';
import { secureHeaders } from 'hono/secure-headers';
import { AppError } from './lib/app-error';
import { requestIdMiddleware } from './middleware/request-id';
import { healthRoutes } from './routes/health';
import type { AppEnvironment } from './types';

export function createApp(): Hono<AppEnvironment> {
  const app = new Hono<AppEnvironment>();

  app.use('*', requestIdMiddleware);
  app.use('*', secureHeaders());

  app.route('/api/v1/health', healthRoutes);

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
