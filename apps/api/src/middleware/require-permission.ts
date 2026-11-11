import type { Permission } from '@wison/contracts';
import { createMiddleware } from 'hono/factory';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

export const requirePermission = (permission: Permission) =>
  createMiddleware<AppEnvironment>(async (context, next) => {
    if (!context.get('user').permissions.includes(permission)) {
      throw new AppError('FORBIDDEN', 403, 'Access is not permitted.');
    }
    await next();
  });
