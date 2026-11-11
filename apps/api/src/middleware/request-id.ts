import { RequestIdSchema } from '@wison/contracts';
import { createMiddleware } from 'hono/factory';
import type { AppEnvironment } from '../types';

export const requestIdMiddleware = createMiddleware<AppEnvironment>(async (context, next) => {
  const inbound = context.req.header('x-request-id');
  const parsed = RequestIdSchema.safeParse(inbound);
  const requestId = parsed.success ? parsed.data : `req_${crypto.randomUUID()}`;

  context.set('requestId', requestId);
  try {
    await next();
  } finally {
    context.header('x-request-id', requestId);
  }
});
