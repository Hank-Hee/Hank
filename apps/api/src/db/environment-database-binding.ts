import type { DatabaseBinding } from '../auth/database-context';

interface EnvironmentDatabaseBindings {
  HYPERDRIVE?: DatabaseBinding;
  DATABASE_URL?: string;
}

export function resolveDatabaseBinding(bindings: EnvironmentDatabaseBindings): DatabaseBinding {
  if (bindings.HYPERDRIVE) return bindings.HYPERDRIVE;
  if (bindings.DATABASE_URL) return { connectionString: bindings.DATABASE_URL };
  throw new Error('Database binding is not configured.');
}
