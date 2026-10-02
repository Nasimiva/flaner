import type { Pool, PoolClient } from 'pg';

export type Db = Pick<PoolClient, 'query'>;

/** Runs `work` in a transaction; rolls back on any error. */
export async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

export function isUniqueViolation(error: unknown, constraint?: string): boolean {
  const pg = error as { code?: string; constraint?: string };
  return pg?.code === '23505' && (!constraint || pg.constraint === constraint);
}
