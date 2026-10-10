import { z } from 'zod';
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { demoUserId } from './environment-token-verifier';
import type { TokenVerifier } from './types';

export interface CloudflareAccessBindings {
  CLOUDFLARE_ACCESS_AUD: string;
  CLOUDFLARE_ACCESS_ALLOWED_EMAILS: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: string;
}

const resolverCache = new Map<string, JWTVerifyGetKey>();
const defaultResolverFactory = (url: URL): JWTVerifyGetKey =>
  createRemoteJWKSet(url, { cacheMaxAge: 600_000 });

export function createCloudflareAccessVerifier(
  bindings: CloudflareAccessBindings,
  resolverFactory: (url: URL) => JWTVerifyGetKey = defaultResolverFactory,
): TokenVerifier {
  const teamDomain = new URL(bindings.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
  if (
    teamDomain.protocol !== 'https:'
    || !teamDomain.hostname.endsWith('.cloudflareaccess.com')
    || teamDomain.pathname !== '/'
    || teamDomain.search
    || teamDomain.hash
    || teamDomain.username
    || teamDomain.password
  ) {
    throw new Error('Cloudflare Access team domain must be an HTTPS cloudflareaccess.com origin.');
  }
  if (!bindings.CLOUDFLARE_ACCESS_AUD.trim()) {
    throw new Error('Cloudflare Access audience is required.');
  }
  const allowedEmails = new Set(
    bindings.CLOUDFLARE_ACCESS_ALLOWED_EMAILS
      .split(',')
      .map((email) => z.email().parse(email.trim()).toLocaleLowerCase())
      .filter(Boolean),
  );
  if (!allowedEmails.size) throw new Error('Cloudflare Access email allowlist is required.');

  const issuer = teamDomain.origin;
  const jwksUrl = new URL('/cdn-cgi/access/certs', issuer);
  let resolver = resolverFactory === defaultResolverFactory
    ? resolverCache.get(jwksUrl.href)
    : undefined;
  if (!resolver) resolver = resolverFactory(jwksUrl);
  if (resolverFactory === defaultResolverFactory) resolverCache.set(jwksUrl.href, resolver);

  return {
    async verify(token) {
      const result = await jwtVerify(token, resolver, {
        algorithms: ['RS256'],
        audience: bindings.CLOUDFLARE_ACCESS_AUD,
        issuer,
        requiredClaims: ['exp', 'sub', 'email'],
      });
      const email = z.email().parse(result.payload.email).toLocaleLowerCase();
      if (!allowedEmails.has(email)) throw new Error('Cloudflare Access email is not permitted.');
      return {
        userId: demoUserId,
        email,
      };
    },
  };
}
