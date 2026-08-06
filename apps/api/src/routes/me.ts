import { Hono } from 'hono';
import type { AppEnvironment } from '../types';

export const meRoutes = new Hono<AppEnvironment>().get('/', (context) => {
  context.header('cache-control', 'private, no-store');
  return context.json(context.get('user'));
});
