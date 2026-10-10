import { Client } from 'pg';
import type { VerifiedIdentity } from './types';

export interface SqlResult<Row extends Record<string, unknown> = Record<string, unknown>> { rows: Row[] }
export interface SqlClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    values?: readonly unknown[],
  ): Promise<SqlResult<Row>>;
}
export interface DatabaseBinding { connectionString: string }

export async function withDatabaseContext<T>(
  binding: DatabaseBinding,
  identity: VerifiedIdentity,
  requestId: string,
  run: (client: SqlClient) => Promise<T>,
  createClient: (connectionString: string) => SqlClient = (connectionString) =>
    new Client({ connectionString }) as unknown as SqlClient,
): Promise<T> {
  const client = createClient(binding.connectionString);
  let began = false;
  let primaryError: unknown;
  try {
    await client.connect();
    await client.query('BEGIN');
    began = true;
    await client.query('SET LOCAL ROLE app_runtime');
    await client.query("select set_config('app.user_id', $1, true)", [identity.userId]);
    await client.query("select set_config('app.request_id', $1, true)", [requestId]);
    const result = await run(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    primaryError = error;
    if (began) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        primaryError = new AggregateError(
          [error, rollbackError],
          'Database operation and rollback both failed.',
        );
      }
    }
    throw primaryError;
  } finally {
    try {
      await client.end();
    } catch (closeError) {
      if (primaryError === undefined) throw closeError;
      throw new AggregateError(
        [primaryError, closeError],
        'Database operation and cleanup both failed.',
      );
    }
  }
}
