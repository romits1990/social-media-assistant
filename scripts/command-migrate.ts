import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { db, closeDbConnection } from '@/lib/db';

const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

async function run() {
  const client = await db.connect();

  try {
    console.log('🔄 [Migrations] Checking database migration state...');

    // 1. Ensure tracking table exists (Laravel equivalent of 'migrations' table)
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // 2. Fetch already executed migrations
    const { rows } = await client.query('SELECT name FROM schema_migrations');
    const executedMigrations = new Set(rows.map(r => r.name));

    // 3. Read migration files from disk in sorted numerical order
    const files = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter(f => f.endsWith('.sql')).sort();

    let appliedCount = 0;

    for (const file of sqlFiles) {
      if (executedMigrations.has(file)) continue;

      console.log(`🚀 [Migrating] Executing: ${file}`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sqlContent = await fs.readFile(filePath, 'utf-8');

      // 4. Run migration file inside an atomic transaction
      await client.query('BEGIN');
      await client.query(sqlContent);
      await client.query(
        'INSERT INTO schema_migrations (name) VALUES ($1)', 
        [file]
      );
      await client.query('COMMIT');

      console.log(`✅ [Migrated] Successfully applied: ${file}`);
      appliedCount++;
    }

    if (appliedCount === 0) {
      console.log('✨ [Migrations] Database is already up to date!');
    } else {
      console.log(`🎉 [Migrations] Applied ${appliedCount} migration(s) successfully.`);
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ [Migration Failed] Transaction rolled back:', error);
    process.exitCode = 1;
  } finally {
    client.release();
    await closeDbConnection();
    process.exit(process.exitCode || 0);
  }
}

run();