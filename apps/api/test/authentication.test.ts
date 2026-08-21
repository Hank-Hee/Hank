import {
  ApiErrorResponseSchema,
  UserContextSchema,
  type Permission,
  type Role,
} from '@wison/contracts';
import type { PermissionLoader, TokenVerifier } from '../src/auth/types';
import { AppError } from '../src/lib/app-error';
import { describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

const identity = { userId: '00000000-0000-4000-8000-000000000001' };
const user = UserContextSchema.parse({
  userId: identity.userId,
  email: 'user@example.com',
  roles: ['sales_bd'],
  permissions: ['platform.access'],
});

function appWith(options: {
  accessVerifier?: TokenVerifier;
  factoryError?: Error;
  loaderError?: Error;
  permissions?: Permission[];
  roles?: Role[];
  verifierError?: Error;
} = {}) {
  const verifier: TokenVerifier = {
    verify: vi.fn(async () => {
      if (options.verifierError) throw options.verifierError;
      return identity;
    }),
  };
  const loader: PermissionLoader = {
    load: vi.fn(async () => {
      if (options.loaderError) throw options.loaderError;
      return {
        ...user,
        permissions: options.permissions ?? user.permissions,
        roles: options.roles ?? user.roles,
      };
    }),
  };
  return createApp(() => {
    if (options.factoryError) throw options.factoryError;
    return { accessVerifier: options.accessVerifier, loader, verifier };
  });
}

describe('GET /api/v1/me', () => {
  it('uses the fixed read-only identity without a visible login only in local demo mode', async () => {
    const response = await appWith().request('/api/v1/me', undefined, {
      DEMO_AUTH_ENABLED: 'true',
    });
    expect(response.status).toBe(200);
  });

  it('prefers a verified Cloudflare Access assertion for UAT requests', async () => {
    const accessVerifier: TokenVerifier = {
      verify: vi.fn(async () => identity),
    };
    const response = await appWith({ accessVerifier }).request('/api/v1/me', {
      headers: {
        authorization: 'Bearer must-not-win',
        'cf-access-jwt-assertion': 'access-jwt',
      },
    });
    expect(response.status).toBe(200);
    expect(accessVerifier.verify).toHaveBeenCalledWith('access-jwt');
  });

  it.each([undefined, 'Basic abc', 'Bearer', 'Bearer a b'])(
    'rejects missing or malformed bearer %s',
    async (authorization) => {
      const headers = authorization ? { authorization } : undefined;
      expect((await appWith().request('/api/v1/me', { headers })).status).toBe(401);
    },
  );

  it('keeps future child paths inside the same authentication boundary', async () => {
    expect((await appWith().request('/api/v1/me/future-child')).status).toBe(401);
  });

  it('requires explicit platform.access even for super_admin', async () => {
    const response = await appWith({ permissions: [], roles: ['super_admin'] }).request('/api/v1/me', {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(403);
    expect(await response.text()).not.toContain('platform.access');
  });

  it('returns the strict user context for an explicitly permitted user', async () => {
    const response = await appWith().request('/api/v1/me', {
      headers: { authorization: 'Bearer token' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(await response.json()).toEqual(user);
  });

  it('collapses verifier details into the safe unauthorized envelope', async () => {
    const response = await appWith({ verifierError: new Error('sensitive JOSE detail') }).request(
      '/api/v1/me',
      { headers: { authorization: 'Bearer token' } },
    );
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(401);
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(body.error.message).toBe('Authentication is required.');
    expect(JSON.stringify(body)).not.toContain('sensitive JOSE detail');
  });

  it('collapses permission-loader failures into the safe internal-error envelope', async () => {
    const response = await appWith({ loaderError: new Error('sensitive PostgreSQL detail') }).request(
      '/api/v1/me',
      { headers: { authorization: 'Bearer token' } },
    );
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred.');
    expect(JSON.stringify(body)).not.toContain('sensitive PostgreSQL detail');
  });

  it('preserves an explicit loader denial as the safe forbidden envelope', async () => {
    const response = await appWith({
      loaderError: new AppError('FORBIDDEN', 403, 'Access is not permitted.'),
    }).request('/api/v1/me', { headers: { authorization: 'Bearer token' } });
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(403);
    expect(body.error).toMatchObject({ code: 'FORBIDDEN', message: 'Access is not permitted.' });
  });

  it('collapses auth-service configuration failures into the safe internal envelope', async () => {
    const response = await appWith({
      factoryError: new Error('sensitive binding detail'),
    }).request('/api/v1/me', { headers: { authorization: 'Bearer token' } });
    const body = ApiErrorResponseSchema.parse(await response.json());
    expect(response.status).toBe(500);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(JSON.stringify(body)).not.toContain('sensitive binding detail');
  });
});
