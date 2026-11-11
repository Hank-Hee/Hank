import { describe, expect, it, vi } from 'vitest';
import { withDatabaseContext, type SqlClient } from '../src/auth/database-context';

function mockClient(failOnProtectedQuery = false) {
  const calls: Array<[string, readonly unknown[] | undefined]> = [];
  const client: SqlClient = {
    connect: vi.fn(async () => undefined),
    end: vi.fn(async () => undefined),
    query: vi.fn(async (text: string, values?: readonly unknown[]) => {
      calls.push([text, values]);
      if (failOnProtectedQuery && text === 'select protected') throw new Error('db failure');
      return { rows: [] };
    }),
  };
  return { calls, client };
}

const identity = { userId: '00000000-0000-4000-8000-000000000001' };

describe('withDatabaseContext', () => {
  it('uses one client and the exact transaction-local context order', async () => {
    const { calls, client } = mockClient();
    await withDatabaseContext(
      { connectionString: 'postgres://local' },
      identity,
      'req_database_12345678',
      (sql) => sql.query('select protected'),
      () => client,
    );

    expect(calls).toEqual([
      ['BEGIN', undefined],
      ['SET LOCAL ROLE app_runtime', undefined],
      ["select set_config('app.user_id', $1, true)", [identity.userId]],
      ["select set_config('app.request_id', $1, true)", ['req_database_12345678']],
      ['select protected', undefined],
      ['COMMIT', undefined],
    ]);
    expect(client.end).toHaveBeenCalledOnce();
  });

  it('rolls back and closes the client on a protected-query error', async () => {
    const { calls, client } = mockClient(true);
    await expect(
      withDatabaseContext(
        { connectionString: 'postgres://local' },
        identity,
        'req_database_12345678',
        (sql) => sql.query('select protected'),
        () => client,
      ),
    ).rejects.toThrow('db failure');
    expect(calls.at(-1)?.[0]).toBe('ROLLBACK');
    expect(client.end).toHaveBeenCalledOnce();
  });

  it('still closes the client when connect fails', async () => {
    const { calls, client } = mockClient();
    vi.mocked(client.connect).mockRejectedValueOnce(new Error('connect failure'));
    await expect(
      withDatabaseContext(
        { connectionString: 'postgres://local' },
        identity,
        'req_database_12345678',
        (sql) => sql.query('select protected'),
        () => client,
      ),
    ).rejects.toThrow('connect failure');
    expect(calls).toEqual([]);
    expect(client.end).toHaveBeenCalledOnce();
  });
});
