import { describe, expect, it } from 'vitest';
import { createEnvironmentTokenVerifier, demoUserId } from '../src/auth/environment-token-verifier';

describe('environment token verifier', () => {
  it('accepts the fixed local token without requiring production JWT bindings in demo mode', async () => {
    const verifier = createEnvironmentTokenVerifier({ DEMO_AUTH_ENABLED: 'true' });
    await expect(verifier.verify('demo.local')).resolves.toEqual({ userId: demoUserId });
  });

  it('does not accept the local token when demo mode is disabled', async () => {
    const verifier = createEnvironmentTokenVerifier({ DEMO_AUTH_ENABLED: 'false' });
    await expect(verifier.verify('demo.local')).rejects.toThrow();
  });
});
