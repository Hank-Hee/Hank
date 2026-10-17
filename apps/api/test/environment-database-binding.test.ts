import { describe, expect, it } from 'vitest';
import { resolveDatabaseBinding } from '../src/db/environment-database-binding';

describe('environment database binding', () => {
  it('uses Hyperdrive in production and a direct PostgreSQL URL in local development', () => {
    const hyperdrive = { connectionString: 'postgresql://hyperdrive.example/db' };
    expect(resolveDatabaseBinding({ HYPERDRIVE: hyperdrive })).toBe(hyperdrive);
    expect(resolveDatabaseBinding({ DATABASE_URL: 'postgresql://127.0.0.1/hank_platform_test' }))
      .toEqual({ connectionString: 'postgresql://127.0.0.1/hank_platform_test' });
  });

  it('fails clearly when neither database source is configured', () => {
    expect(() => resolveDatabaseBinding({})).toThrow('Database binding is not configured.');
  });
});
