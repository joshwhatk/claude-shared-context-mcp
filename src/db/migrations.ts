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

      // ============================================
      // Multi-tenancy migrations (added for user isolation)
      // ============================================

      // Create users table (Firebase-ready)
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          auth_provider TEXT NOT NULL DEFAULT 'manual',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('[migrations] users table ready');

      // Create api_keys table (stores hashed keys)
      await client.query(`
        CREATE TABLE IF NOT EXISTS api_keys (
          key_hash TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_used_at TIMESTAMP WITH TIME ZONE
        )
      `);
      console.log('[migrations] api_keys table ready');

      // Create index on api_keys.user_id
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id)
      `);
      console.log('[migrations] api_keys index ready');

      // Add user_id column to shared_context (nullable initially for migration)
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'shared_context' AND column_name = 'user_id'
          ) THEN
            ALTER TABLE shared_context ADD COLUMN user_id TEXT;
          END IF;
        END $$
      `);
      console.log('[migrations] shared_context.user_id column ready');

      // Add user_id column to context_history (nullable initially for migration)
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'context_history' AND column_name = 'user_id'
          ) THEN
            ALTER TABLE context_history ADD COLUMN user_id TEXT;
          END IF;
        END $$
      `);
      console.log('[migrations] context_history.user_id column ready');

      // Create composite UNIQUE constraint for user+key (required for ON CONFLICT)
      // First, we need to drop the old PRIMARY KEY on just `key` since it prevents
      // multi-tenancy (different users should be able to use the same key names)
      await client.query(`
        DO $$
        BEGIN
          -- Drop old primary key constraint if it exists (key-only)
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE table_name = 'shared_context'
            AND constraint_type = 'PRIMARY KEY'
            AND constraint_name = 'shared_context_pkey'
          ) THEN
            -- Check if the PK is on just 'key' (single column)
            IF (
              SELECT COUNT(*) FROM information_schema.key_column_usage
              WHERE table_name = 'shared_context'
              AND constraint_name = 'shared_context_pkey'
            ) = 1 THEN
              ALTER TABLE shared_context DROP CONSTRAINT shared_context_pkey;
              RAISE NOTICE 'Dropped old single-column primary key';
            END IF;
          END IF;
        END $$
      `);
      console.log('[migrations] shared_context old PK check complete');

      // Drop old non-unique index if it exists
      await client.query(`
        DROP INDEX IF EXISTS idx_shared_context_user_key
      `);

      // Create UNIQUE constraint on (user_id, key) - required for ON CONFLICT
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_constraint
            WHERE conname = 'shared_context_user_key_unique'
          ) THEN
            ALTER TABLE shared_context
            ADD CONSTRAINT shared_context_user_key_unique UNIQUE (user_id, key);
            RAISE NOTICE 'Created unique constraint on (user_id, key)';
          END IF;
        END $$
      `);
      console.log('[migrations] shared_context user_key unique constraint ready');

      // ============================================
      // Admin features migrations
      // ============================================

      // Add is_admin column to users table
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'is_admin'
          ) THEN
            ALTER TABLE users ADD COLUMN is_admin BOOLEAN DEFAULT false;
          END IF;
        END $$
      `);
      console.log('[migrations] users.is_admin column ready');

      // Create admin_audit_log table for tracking admin actions
      await client.query(`
        CREATE TABLE IF NOT EXISTS admin_audit_log (
          id SERIAL PRIMARY KEY,
          admin_user_id TEXT NOT NULL REFERENCES users(id),
          action TEXT NOT NULL,
          target_user_id TEXT,
          details JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);
      console.log('[migrations] admin_audit_log table ready');

      // Create index on admin_audit_log for efficient queries by admin
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_user_id
        ON admin_audit_log (admin_user_id)
      `);
      console.log('[migrations] admin_audit_log index ready');

      // Set joshwhatk as admin (if user exists)
      await client.query(`
        UPDATE users SET is_admin = true WHERE id = 'joshwhatk'
      `);
      console.log('[migrations] joshwhatk admin status set');

      // ============================================
      // Clerk OAuth migrations
      // ============================================

      // Add clerk_id column to users table for Clerk OAuth integration
      await client.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'users' AND column_name = 'clerk_id'
          ) THEN
            ALTER TABLE users ADD COLUMN clerk_id TEXT UNIQUE;
          END IF;
        END $$
      `);
      console.log('[migrations] users.clerk_id column ready');

      // Create index on clerk_id for efficient lookups
      await client.query(`
        CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id)
      `);
      console.log('[migrations] users.clerk_id index ready');

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
