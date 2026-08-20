import { Pool, PoolConfig } from 'pg';

const connectionString =
  process.env.DATABASE_URL ||
  'postgres://postgres:postgres@localhost:5432/social_assistant';

// Check if connecting to Neon/Cloud SSL endpoint
const isRemoteDb =
  connectionString.includes('neon.tech') ||
  connectionString.includes('sslmode=require') ||
  process.env.NODE_ENV === 'production';

const poolConfig: PoolConfig = {
  connectionString,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 15000, // 15s cold-start grace for Neon wakeups
  ssl: isRemoteDb ? { rejectUnauthorized: false } : undefined,
};

// 🎯 Singleton declaration to prevent connection exhaustion during Next.js Hot Reloads
declare global {
  var _pgPoolInstance: Pool | undefined;
}

export const db: Pool = global._pgPoolInstance || new Pool(poolConfig);

// Catch background idle client disconnects so they don't terminate the process
db.on('error', (err) => {
  console.error('⚠️ [Postgres Pool] Unexpected idle client error:', err.message);
});

if (process.env.NODE_ENV !== 'production') {
  global._pgPoolInstance = db;
}

/**
 * Gracefully drains the connection pool.
 * Note: Only call this when terminating a standalone worker process.
 * Do not call this inside Next.js serverless route lifecycles.
 */
export const closeDbConnection = async (): Promise<void> => {
  try {
    await db.end();
    console.log('🔌 [DB] Connection pool successfully drained.');
  } catch (error) {
    console.error('❌ [DB] Error during pool drain:', error);
  }
};