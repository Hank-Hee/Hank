import type { UserContext } from '@wison/contracts';

export interface VerifiedIdentity { userId: string; email?: string }
export interface TokenVerifier { verify(token: string): Promise<VerifiedIdentity> }
export interface PermissionLoader {
  load(identity: VerifiedIdentity, requestId: string): Promise<UserContext>;
}
