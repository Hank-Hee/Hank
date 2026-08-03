import type { UserContext } from '@wison/contracts';
import type { VerifiedIdentity } from './auth/types';

export interface AppBindings {
  APP_VERSION: string;
  HYPERDRIVE: Hyperdrive;
  JWT_ALGORITHM: string;
  JWKS_CACHE_EPOCH: string;
  SUPABASE_AUDIENCE: string;
  SUPABASE_ISSUER: string;
}
export interface AppVariables {
  identity: VerifiedIdentity;
  requestId: string;
  user: UserContext;
}
export type AppEnvironment = { Bindings: AppBindings; Variables: AppVariables };
