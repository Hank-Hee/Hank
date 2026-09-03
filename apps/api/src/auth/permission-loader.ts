import { UserContextSchema, type UserContext } from '@wison/contracts';
import { AppError } from '../lib/app-error';
import { withDatabaseContext, type DatabaseBinding } from './database-context';
import type { PermissionLoader, VerifiedIdentity } from './types';

export function parsePermissionContext(
  identity: VerifiedIdentity,
  value: unknown,
): UserContext {
  if (value === null || value === undefined) {
    throw new AppError('FORBIDDEN', 403, 'Access is not permitted.');
  }
  const parsed = UserContextSchema.safeParse(value);
  if (!parsed.success || parsed.data.userId !== identity.userId) {
    throw new Error('Permission context is invalid.');
  }
  return parsed.data;
}

export function createPermissionLoader(binding: DatabaseBinding): PermissionLoader {
  return {
    load(identity, requestId) {
      return withDatabaseContext(binding, identity, requestId, async (client) => {
        const result = await client.query<{ context: unknown }>(
          'select app_private.get_current_user_context() as context',
        );
        return parsePermissionContext(identity, result.rows[0]?.context);
      });
    },
  };
}
