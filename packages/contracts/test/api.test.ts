import { describe, expect, it } from 'vitest';
import {
  ApiErrorResponseSchema,
  HealthResponseSchema,
} from '../src/index';

describe('HealthResponseSchema', () => {
  it('accepts the canonical API health response', () => {
    const parsed = HealthResponseSchema.parse({
      status: 'ok',
      service: 'api',
      version: '0.1.0',
      timestamp: '2026-07-30T12:00:00.000Z',
    });

    expect(parsed.status).toBe('ok');
  });

  it('accepts a timestamp with an explicit positive offset', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        timestamp: '2026-07-30T20:00:00.000+08:00',
      }),
    ).not.toThrow();
  });

  it('rejects a timestamp without UTC Z or an explicit offset', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        timestamp: '2026-07-30T12:00:00',
      }),
    ).toThrow();
  });

  it('rejects an unknown field', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok',
        service: 'api',
        version: '0.1.0',
        timestamp: '2026-07-30T12:00:00.000Z',
        database: 'up',
      }),
    ).toThrow();
  });

  it('rejects an empty version', () => {
    expect(() =>
      HealthResponseSchema.parse({
        status: 'ok', service: 'api', version: '', timestamp: '2026-07-30T12:00:00.000Z',
      }),
    ).toThrow();
  });
});

describe('ApiErrorResponseSchema', () => {
  it.each(['BAD_REQUEST', 'UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'INTERNAL_ERROR'])(
    'accepts published code %s',
    (code) => {
      const parsed = ApiErrorResponseSchema.parse({
        error: {
          code,
          message: 'Authentication is required.',
          requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
        },
      });

      expect(parsed.error.code).toBe(code);
    },
  );

  it.each(['req_a1234567', `req_${'a'.repeat(128)}`])(
    'accepts request-id boundary %s',
    (requestId) => {
      expect(() => ApiErrorResponseSchema.parse({
        error: { code: 'NOT_FOUND', message: 'Not found.', requestId },
      })).not.toThrow();
    },
  );

  it.each(['VALIDATION_ERROR', 'SERVICE_UNAVAILABLE'])('rejects unpublished code %s', (code) => {
    expect(() =>
      ApiErrorResponseSchema.parse({
        error: {
          code,
          message: 'Rejected code.',
          requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
        },
      }),
    ).toThrow();
  });

  it.each(['req_short', 'request\nforged', '01J4P4Y7H4XZ8WWA73N42Q4Z5B'])(
    'rejects malformed request id %s',
    (requestId) => {
      expect(() =>
        ApiErrorResponseSchema.parse({
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Unexpected error.',
            requestId,
          },
        }),
      ).toThrow();
    },
  );

  it('rejects unknown nested fields', () => {
    expect(() =>
      ApiErrorResponseSchema.parse({
        error: {
          code: 'NOT_FOUND',
          message: 'Not found.',
          requestId: 'req_01J4P4Y7H4XZ8WWA73N42Q4Z5B',
          stack: 'secret',
        },
      }),
    ).toThrow();
  });

  it.each(['', 'x'.repeat(501)])('rejects unsafe message length', (message) => {
    expect(() => ApiErrorResponseSchema.parse({
      error: { code: 'INTERNAL_ERROR', message, requestId: 'req_a1234567' },
    })).toThrow();
  });

  it('rejects an unknown outer field', () => {
    expect(() => ApiErrorResponseSchema.parse({
      error: { code: 'NOT_FOUND', message: 'Not found.', requestId: 'req_a1234567' },
      debug: true,
    })).toThrow();
  });
});
