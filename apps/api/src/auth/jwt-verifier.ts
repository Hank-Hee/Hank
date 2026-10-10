import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { TokenVerifier } from './types';

export interface JwtBindings {
  JWT_ALGORITHM: string;
  JWKS_CACHE_EPOCH: string;
  SUPABASE_AUDIENCE: string;
  SUPABASE_ISSUER: string;
}
const resolverCache = new Map<string, JWTVerifyGetKey>();
export function clearJwksResolverCache() { resolverCache.clear(); }

export function createTokenVerifier(
  bindings: JwtBindings,
  resolverFactory: (url: URL) => JWTVerifyGetKey = (url) =>
    createRemoteJWKSet(url, { cacheMaxAge: 600_000 }),
): TokenVerifier {
  if (!['ES256', 'RS256'].includes(bindings.JWT_ALGORITHM)) {
    throw new Error('JWT algorithm configuration is not approved.');
  }
  const issuerUrl = new URL(bindings.SUPABASE_ISSUER);
  const isLoopback = ['127.0.0.1', 'localhost'].includes(issuerUrl.hostname);
  const isAllowedProtocol =
    issuerUrl.protocol === 'https:' || (issuerUrl.protocol === 'http:' && isLoopback);
  if (!isAllowedProtocol) {
    throw new Error('Supabase issuer must use HTTPS.');
  }
  if (
    issuerUrl.pathname.replace(/\/+$/, '') !== '/auth/v1' ||
    issuerUrl.search || issuerUrl.hash || issuerUrl.username || issuerUrl.password
  ) {
    throw new Error('Supabase issuer must end at /auth/v1.');
  }
  const normalizedIssuer = issuerUrl.href.replace(/\/+$/, '');
  const jwksUrl = new URL(`${normalizedIssuer}/.well-known/jwks.json`);
  const key = `${jwksUrl.href}:${bindings.JWKS_CACHE_EPOCH}`;
  let resolver = resolverCache.get(key);
  if (!resolver) {
    resolver = resolverFactory(jwksUrl);
    resolverCache.set(key, resolver);
  }
  return {
    async verify(token) {
      const result = await jwtVerify(token, resolver, {
        algorithms: [bindings.JWT_ALGORITHM],
        audience: bindings.SUPABASE_AUDIENCE,
        issuer: normalizedIssuer,
        requiredClaims: ['exp', 'sub'],
      });
      return { userId: z.uuid().parse(result.payload.sub) };
    },
  };
}
