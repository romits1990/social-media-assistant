import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/social_assistant';

export const db = new Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

/**
 * Gracefully drains the connection pool.
 * MUST only be called when the entire Node process is shutting down.
 */
export const closeDbConnection = async (): Promise<void> => {
  await db.end();
  console.log('🔌 [DB] Connection pool successfully drained.');
};