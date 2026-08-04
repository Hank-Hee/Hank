import { SignJWT, generateKeyPair } from 'jose';
import { describe, expect, it, vi } from 'vitest';
import { createCloudflareAccessVerifier } from '../src/auth/cloudflare-access-verifier';
import { demoUserId } from '../src/auth/environment-token-verifier';

const bindings = {
  CLOUDFLARE_ACCESS_AUD: 'uat-audience',
  CLOUDFLARE_ACCESS_TEAM_DOMAIN: 'https://wison.cloudflareaccess.com',
};

describe('Cloudflare Access verifier', () => {
  it('validates issuer, audience and email, then maps UAT readers to the shared read-only profile', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ email: 'reader@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(bindings.CLOUDFLARE_ACCESS_TEAM_DOMAIN)
      .setAudience(bindings.CLOUDFLARE_ACCESS_AUD)
      .setSubject('access-user-id')
      .setExpirationTime('5m')
      .sign(privateKey);
    const verifier = createCloudflareAccessVerifier(bindings, () => async () => publicKey);

    await expect(verifier.verify(token)).resolves.toEqual({
      email: 'reader@example.com',
      userId: demoUserId,
    });
  });

  it('rejects a token for another Access application', async () => {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const token = await new SignJWT({ email: 'reader@example.com' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test' })
      .setIssuer(bindings.CLOUDFLARE_ACCESS_TEAM_DOMAIN)
      .setAudience('different-audience')
      .setSubject('access-user-id')
      .setExpirationTime('5m')
      .sign(privateKey);
    const verifier = createCloudflareAccessVerifier(bindings, () => async () => publicKey);

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('does not share injected test resolvers across verifier instances', async () => {
    const { publicKey } = await generateKeyPair('RS256');
    const firstFactory = vi.fn(() => async () => publicKey);
    const secondFactory = vi.fn(() => async () => publicKey);

    createCloudflareAccessVerifier(bindings, firstFactory);
    createCloudflareAccessVerifier(bindings, secondFactory);

    expect(firstFactory).toHaveBeenCalledOnce();
    expect(secondFactory).toHaveBeenCalledOnce();
  });
});
