import { createMiddleware } from 'hono/factory';
import type { AuthServicesFactory } from './authentication';
import { authentication } from './authentication';
import type { AppEnvironment } from '../types';

export const PUBLIC_READER_ID = '00000000-0000-4000-8000-000000000030';
export const isPublicReadRequest = (
  env: AppEnvironment['Bindings'] | undefined,
  method: string,
) => env?.PUBLIC_READ_ONLY === 'true' && (method === 'GET' || method === 'HEAD');

export const readOnlyAccess = (getServices: AuthServicesFactory) => {
  const authenticated = authentication(getServices);
  return createMiddleware<AppEnvironment>(async (context, next) => {
    if (isPublicReadRequest(context.env, context.req.method)) {
      context.set('identity', { userId: PUBLIC_READER_ID });
      await next();
      return;
    }
    await authenticated(context, next);
  });
};
