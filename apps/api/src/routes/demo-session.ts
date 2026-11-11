import { DemoSessionRequestSchema } from '@wison/contracts';
import { Hono } from 'hono';
import { AppError } from '../lib/app-error';
import type { AppEnvironment } from '../types';

export const demoSessionRoutes = new Hono<AppEnvironment>().post('/', async (context) => {
  if (context.env?.DEMO_AUTH_ENABLED !== 'true') {
    throw new AppError('NOT_FOUND', 404, 'The requested API route does not exist.');
  }
  const body = await context.req.json().catch(() => null);
  const parsed = DemoSessionRequestSchema.safeParse(body);
  if (!parsed.success) throw new AppError('BAD_REQUEST', 400, 'A valid email is required.');
  context.header('cache-control', 'no-store');
  const secure = new URL(context.req.url).protocol === 'https:' ? '; Secure' : '';
  context.header(
    'set-cookie',
    `demo_session=demo.local; Path=/; Max-Age=28800; HttpOnly; SameSite=Lax${secure}`,
  );
  return context.json({ accessToken: 'demo.local' as const, email: parsed.data.email });
});
