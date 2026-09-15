import { createTokenVerifier, type JwtBindings } from './jwt-verifier';
import type { TokenVerifier } from './types';

export const demoUserId = '00000000-0000-4000-8000-000000000030';

export function createEnvironmentTokenVerifier(
  bindings: Partial<JwtBindings> & { DEMO_AUTH_ENABLED?: string },
): TokenVerifier {
  let productionVerifier: TokenVerifier | undefined;
  return {
    async verify(token) {
      if (bindings.DEMO_AUTH_ENABLED === 'true' && token === 'demo.local') {
        return { userId: demoUserId };
      }
      productionVerifier ??= createTokenVerifier(bindings as JwtBindings);
      return productionVerifier.verify(token);
    },
  };
}
