import {
  SignJWT,
  createLocalJWKSet,
  exportJWK,
  generateKeyPair,
  type JWK,
} from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearJwksResolverCache,
  createTokenVerifier,
  type JwtBindings,
} from '../src/auth/jwt-verifier';

const bindings: JwtBindings = {
  JWT_ALGORITHM: 'ES256',
  JWKS_CACHE_EPOCH: 'v1',
  SUPABASE_AUDIENCE: 'authenticated',
  SUPABASE_ISSUER: 'https://project.supabase.co/auth/v1',
};
const userId = '00000000-0000-4000-8000-000000000001';

interface TokenOptions {
  audience?: string;
  expiration?: string | number;
  includeExpiration?: boolean;
  includeSubject?: boolean;
  issuer?: string;
}

async function fixture() {
  const { privateKey, publicKey } = await generateKeyPair('ES256');
  const { privateKey: wrongPrivateKey } = await generateKeyPair('ES256');
  const publicJwk: JWK = { ...(await exportJWK(publicKey)), alg: 'ES256', kid: 'test-key' };
  const resolver = createLocalJWKSet({ keys: [publicJwk] });

  const build = (claims: Record<string, unknown> = {}, options: TokenOptions = {}) => {
    const payload = options.includeSubject === false ? claims : { sub: userId, ...claims };
    let token = new SignJWT(payload)
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setIssuer(options.issuer ?? bindings.SUPABASE_ISSUER)
      .setAudience(options.audience ?? bindings.SUPABASE_AUDIENCE)
      .setIssuedAt();
    if (options.includeExpiration !== false) {
      token = token.setExpirationTime(options.expiration ?? '5m');
    }
    return token;
  };

  const invalidTokens = new Map<string, string>([
    ['wrong issuer', await build({}, { issuer: 'https://wrong.example' }).sign(privateKey)],
    ['missing sub', await build({}, { includeSubject: false }).sign(privateKey)],
    ['missing exp', await build({}, { includeExpiration: false }).sign(privateKey)],
    ['expired', await build({}, { expiration: Math.floor(Date.now() / 1000) - 60 }).sign(privateKey)],
    ['malformed sub', await build({ sub: 'not-a-uuid' }).sign(privateKey)],
    ['wrong audience', await build({}, { audience: 'wrong-audience' }).sign(privateKey)],
    ['wrong signature', await build().sign(wrongPrivateKey)],
    [
      'HS256',
      await new SignJWT({ sub: userId })
        .setProtectedHeader({ alg: 'HS256', kid: 'test-key' })
        .setIssuer(bindings.SUPABASE_ISSUER)
        .setAudience(bindings.SUPABASE_AUDIENCE)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('foundation-test-only-hs256-secret')),
    ],
  ]);

  return {
    invalidTokens,
    resolver,
    validToken: await build().sign(privateKey),
  };
}

beforeEach(() => clearJwksResolverCache());

describe('Supabase JWT verifier', () => {
  it('accepts a correctly signed asymmetric token with UUID sub', async () => {
    const { resolver, validToken } = await fixture();
    const verifier = createTokenVerifier(bindings, () => resolver);
    await expect(verifier.verify(validToken)).resolves.toEqual({ userId });
  });

  it.each([
    'wrong issuer',
    'missing sub',
    'missing exp',
    'expired',
    'malformed sub',
    'wrong audience',
    'wrong signature',
    'HS256',
  ])('rejects %s', async (name) => {
    const { invalidTokens, resolver } = await fixture();
    const verifier = createTokenVerifier(bindings, () => resolver);
    const token = invalidTokens.get(name);
    expect(token).toBeDefined();
    await expect(verifier.verify(token!)).rejects.toThrow();
  });

  it('reuses a JWKS resolver until cache epoch changes', async () => {
    const { resolver } = await fixture();
    const factory = vi.fn(() => resolver);
    createTokenVerifier(bindings, factory);
    createTokenVerifier(bindings, factory);
    createTokenVerifier({ ...bindings, JWKS_CACHE_EPOCH: 'v2' }, factory);
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('derives the project JWKS endpoint from the only trusted issuer URL', async () => {
    const { resolver } = await fixture();
    const factory = vi.fn(() => resolver);
    createTokenVerifier(bindings, factory);
    expect(factory).toHaveBeenCalledWith(
      new URL('https://project.supabase.co/auth/v1/.well-known/jwks.json'),
    );
  });

  it('accepts the other approved asymmetric algorithm', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const publicJwk: JWK = { ...(await exportJWK(publicKey)), alg: 'RS256', kid: 'rsa-key' };
    const resolver = createLocalJWKSet({ keys: [publicJwk] });
    const token = await new SignJWT({ sub: userId })
      .setProtectedHeader({ alg: 'RS256', kid: 'rsa-key' })
      .setIssuer(bindings.SUPABASE_ISSUER)
      .setAudience(bindings.SUPABASE_AUDIENCE)
      .setIssuedAt()
      .setExpirationTime('5m')
      .sign(privateKey);
    const verifier = createTokenVerifier({ ...bindings, JWT_ALGORITHM: 'RS256' }, () => resolver);
    await expect(verifier.verify(token)).resolves.toEqual({ userId });
  });

  it('rejects unapproved algorithms and invalid issuer endpoints', () => {
    expect(() => createTokenVerifier({ ...bindings, JWT_ALGORITHM: 'HS256' })).toThrow(
      'JWT algorithm configuration is not approved.',
    );
    expect(() => createTokenVerifier({
      ...bindings,
      SUPABASE_ISSUER: 'http://project.supabase.co/auth/v1',
    })).toThrow('Supabase issuer must use HTTPS.');
    expect(() => createTokenVerifier({
      ...bindings,
      SUPABASE_ISSUER: 'ftp://localhost/auth/v1',
    })).toThrow('Supabase issuer must use HTTPS.');
    expect(() => createTokenVerifier({
      ...bindings,
      SUPABASE_ISSUER: 'https://project.supabase.co/not-auth',
    })).toThrow('Supabase issuer must end at /auth/v1.');
  });
});
