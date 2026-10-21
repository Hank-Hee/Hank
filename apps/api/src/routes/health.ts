import type { HealthResponse } from '@wison/contracts';
import { Hono } from 'hono';
import type { AppEnvironment } from '../types';

export const healthRoutes = new Hono<AppEnvironment>().get('/', (context) => {
  const body: HealthResponse = {
    status: 'ok',
    service: 'api',
    version: context.env?.APP_VERSION ?? '0.1.0',
    timestamp: new Date().toISOString(),
  };

  return context.json(body, 200);
});
