import { AppError } from '../lib/app-error';
import { createMiddleware } from 'hono/factory';
import type { AppEnvironment } from '../types';
import type { PermissionLoader, TokenVerifier, VerifiedIdentity } from '../auth/types';

export interface AuthServices { loader: PermissionLoader; verifier: TokenVerifier }
export type AuthServicesFactory = (env: AppEnvironment['Bindings']) => AuthServices;
function cookieToken(cookieHeader: string | undefined): string | undefined {
  const value = cookieHeader?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('demo_session='))
    ?.slice('demo_session='.length);
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

export const authentication = (getServices: AuthServicesFactory) =>
  createMiddleware<AppEnvironment>(async (context, next) => {
    const authorization = context.req.header('authorization');
    const match = /^Bearer ([^\s]+)$/.exec(authorization ?? '');
    const token = authorization ? match?.[1] : cookieToken(context.req.header('cookie'));
    if (!token) throw new AppError('UNAUTHORIZED', 401, 'Authentication is required.');
    const services = getServices(context.env);
    let identity: VerifiedIdentity;
    try {
      identity = await services.verifier.verify(token);
    } catch {
      throw new AppError('UNAUTHORIZED', 401, 'Authentication is required.');
    }
    const user = await services.loader.load(identity, context.get('requestId'));
    context.set('identity', identity);
    context.set('user', user);
    await next();
  });
