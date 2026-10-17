import { AppError } from '../lib/app-error';
import { createMiddleware } from 'hono/factory';
import type { AppEnvironment } from '../types';
import type { PermissionLoader, TokenVerifier, VerifiedIdentity } from '../auth/types';

export interface AuthServices { loader: PermissionLoader; verifier: TokenVerifier }
export type AuthServicesFactory = (env: AppEnvironment['Bindings']) => AuthServices;
export const authentication = (getServices: AuthServicesFactory) =>
  createMiddleware<AppEnvironment>(async (context, next) => {
    const match = /^Bearer ([^\s]+)$/.exec(context.req.header('authorization') ?? '');
    const token = match?.[1];
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
