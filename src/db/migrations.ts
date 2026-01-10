import { getClient } from './client.js';

// Advisory lock ID - must be consistent across all instances
// Using arbitrary but fixed value to prevent race conditions during multi-instance startup
const MIGRATION_LOCK_ID = 12345;

/**
 * Run database migrations with advisory lock to prevent race conditions
 * Safe to run multiple times (idempotent)
 */
export async function runMigrations(): Promise<void> {
  const client = await getClient();

  try {
    // Acquire advisory lock to prevent concurrent migrations
    // pg_advisory_lock blocks until lock is acquired
    console.log('[migrations] Acquiring migration lock...');
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    console.log('[migrations] Lock acquired, running migrations...');

    // Run migrations in a transaction
    await client.query('BEGIN');

    try {
      // Create shared_context table
      await client.query(`
        CREATE TABLE IF NOT EXISTS shared_context (
          key TEXT PRIMARY KEY CHECK(length(key) <= 255),
          content TEXT NOT NULL CHECK(length(content) <= 102400),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('[migrations] shared_context table ready');

      // Create index on updated_at for efficient ordering
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_shared_context_updated_at
        ON shared_context (updated_at DESC)
      `);
      console.log('[migrations] shared_context index ready');

      // Create context_history audit table
      await client.query(`
        CREATE TABLE IF NOT EXISTS context_history (
          id SERIAL PRIMARY KEY,
          key TEXT NOT NULL,
          content TEXT NOT NULL,
          action TEXT NOT NULL CHECK(action IN ('create', 'update', 'delete')),
          changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('[migrations] context_history table ready');

      await client.query('COMMIT');
      console.log('[migrations] All migrations completed successfully');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    }
  } finally {
    // Always release the advisory lock
    await client.query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID]);
    console.log('[migrations] Migration lock released');
    client.release();
  }
}

// Allow running migrations directly via: npm run migrate
// Check if this module is being run directly
const isDirectRun = process.argv[1]?.endsWith('migrations.ts') ||
                    process.argv[1]?.endsWith('migrations.js');

if (isDirectRun) {
  // Load environment variables when running directly
  import('dotenv').then((dotenv) => {
    dotenv.config();

    runMigrations()
      .then(() => {
        console.log('[migrations] Migration script completed');
        process.exit(0);
      })
      .catch((err) => {
        console.error('[migrations] Migration script failed:', err);
        process.exit(1);
      });
  });
}
