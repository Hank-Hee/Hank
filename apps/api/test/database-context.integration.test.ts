import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createPermissionLoader } from '../src/auth/permission-loader';

const connectionString = process.env.TEST_DATABASE_URL
  ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
const userId = '00000000-0000-4000-8000-000000000010';
const admin = new Client({ connectionString });

beforeAll(async () => {
  await admin.connect();
  await admin.query('delete from app_private.profiles where user_id = $1', [userId]);
  await admin.query(
    "insert into app_private.profiles (user_id, email, status) values ($1, 'integration@example.com', 'active')",
    [userId],
  );
  await admin.query(
    "insert into app_private.user_roles (user_id, role_code) values ($1, 'sales_bd')",
    [userId],
  );
});

afterAll(async () => {
  await admin.query('delete from app_private.profiles where user_id = $1', [userId]);
  await admin.end();
});

describe('local PostgreSQL context integration', () => {
  it('loads a strict context through the production loader, one transaction, and app_runtime RLS', async () => {
    const result = await createPermissionLoader({ connectionString }).load(
      { userId },
      'req_integration_12345678',
    );
    expect(result).toEqual({
      email: 'integration@example.com',
      permissions: ['platform.access'],
      roles: ['sales_bd'],
      userId,
    });
  });
});
