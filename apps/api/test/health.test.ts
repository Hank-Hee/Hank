import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
  RequestIdSchema,
} from '@wison/contracts';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

describe('GET /api/v1/health', () => {
  it('returns the typed health response and a request id', async () => {
    const response = await createApp().request('/api/v1/health');
    const body = HealthResponseSchema.parse(await response.json());

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(() => RequestIdSchema.parse(response.headers.get('x-request-id'))).not.toThrow();
    expect(body).toMatchObject({ status: 'ok', service: 'api', version: '0.1.0' });
  });

  it('returns the stable error envelope for an unknown API route', async () => {
    const response = await createApp().request('/api/v1/not-a-route');
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
    expect(() => RequestIdSchema.parse(body.error.requestId)).not.toThrow();
  });

  it('preserves only a valid inbound request id', async () => {
    const accepted = await createApp().request('/api/v1/health', {
      headers: { 'x-request-id': 'req_client_12345678' },
    });
    const rejected = await createApp().request('/api/v1/health', {
      headers: { 'x-request-id': 'req_short' },
    });

    expect(accepted.headers.get('x-request-id')).toBe('req_client_12345678');
    expect(rejected.headers.get('x-request-id')).not.toBe('req_short');
    expect(() => RequestIdSchema.parse(rejected.headers.get('x-request-id'))).not.toThrow();
  });

  it('keeps the request id on unexpected errors', async () => {
    const app = createApp();
    app.get('/api/v1/fail-for-test', () => {
      throw new Error('internal detail');
    });

    const response = await app.request('/api/v1/fail-for-test', {
      headers: { 'x-request-id': 'req_failure_12345678' },
    });
    const body = ApiErrorResponseSchema.parse(await response.json());

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(response.headers.get('x-request-id')).toBe('req_failure_12345678');
    expect(body.error.requestId).toBe(response.headers.get('x-request-id'));
    expect(() => RequestIdSchema.parse(body.error.requestId)).not.toThrow();
  });
});
