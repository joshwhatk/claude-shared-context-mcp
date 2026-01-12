#!/usr/bin/env npx tsx
/**
 * Migration script to add multi-tenancy support
 *
 * This script:
 * 1. Creates the 'joshwhatk' user
 * 2. Migrates existing MCP_AUTH_TOKEN to api_keys table
 * 3. Assigns all existing data to 'joshwhatk' user
 * 4. Adds NOT NULL constraints and unique index
 *
 * Usage:
 *   npx tsx scripts/migrate-to-multitenancy.ts
 *
 * Requirements:
 *   - DATABASE_URL environment variable
 *   - MCP_AUTH_TOKEN environment variable (the existing token to migrate)
 */

import { config } from 'dotenv';
import { Pool } from 'pg';
import crypto from 'crypto';

// Load environment variables
config();

const DATABASE_URL = process.env.DATABASE_URL;
const MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN;

if (!DATABASE_URL) {
  console.error('Error: DATABASE_URL environment variable is required');
  process.exit(1);
}

if (!MCP_AUTH_TOKEN) {
  console.error('Error: MCP_AUTH_TOKEN environment variable is required');
  console.error('This is the existing token that will be migrated to the api_keys table');
  process.exit(1);
}

// User details for the initial user
const USER_ID = 'joshwhatk';
const USER_EMAIL = 'josh@joshwhatk.com';
const API_KEY_NAME = 'primary';

function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}

async function migrate(): Promise<void> {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
  });

  const client = await pool.connect();

  try {
    console.log('Starting multi-tenancy migration...\n');

    await client.query('BEGIN');

    // Step 1: Check if user already exists
    const existingUser = await client.query(
      'SELECT id FROM users WHERE id = $1',
      [USER_ID]
    );

    if (existingUser.rows.length > 0) {
      console.log(`User '${USER_ID}' already exists, skipping user creation`);
    } else {
      // Create the joshwhatk user
      await client.query(
        `INSERT INTO users (id, email, auth_provider, created_at, updated_at)
         VALUES ($1, $2, 'manual', NOW(), NOW())`,
        [USER_ID, USER_EMAIL]
      );
      console.log(`Created user: ${USER_ID} (${USER_EMAIL})`);
    }

    // Step 2: Check if API key already exists
    const keyHash = hashApiKey(MCP_AUTH_TOKEN);
    const existingKey = await client.query(
      'SELECT key_hash FROM api_keys WHERE key_hash = $1',
      [keyHash]
    );

    if (existingKey.rows.length > 0) {
      console.log('API key already migrated, skipping');
    } else {
      // Hash and store the existing MCP_AUTH_TOKEN
      await client.query(
        `INSERT INTO api_keys (key_hash, user_id, name, created_at)
         VALUES ($1, $2, $3, NOW())`,
        [keyHash, USER_ID, API_KEY_NAME]
      );
      console.log(`Migrated API key to api_keys table (name: ${API_KEY_NAME})`);
    }

    // Step 3: Count existing data
    const contextCount = await client.query('SELECT COUNT(*) FROM shared_context WHERE user_id IS NULL');
    const historyCount = await client.query('SELECT COUNT(*) FROM context_history WHERE user_id IS NULL');

    console.log(`\nFound ${contextCount.rows[0].count} context entries to migrate`);
    console.log(`Found ${historyCount.rows[0].count} history entries to migrate`);

    // Step 4: Assign all existing data to joshwhatk
    if (parseInt(contextCount.rows[0].count) > 0) {
      await client.query(
        'UPDATE shared_context SET user_id = $1 WHERE user_id IS NULL',
        [USER_ID]
      );
      console.log(`Assigned ${contextCount.rows[0].count} context entries to ${USER_ID}`);
    }

    if (parseInt(historyCount.rows[0].count) > 0) {
      await client.query(
        'UPDATE context_history SET user_id = $1 WHERE user_id IS NULL',
        [USER_ID]
      );
      console.log(`Assigned ${historyCount.rows[0].count} history entries to ${USER_ID}`);
    }

    // Step 5: Add NOT NULL constraints (if not already present)
    // Check if constraint already exists by trying to insert NULL
    try {
      // Try to add NOT NULL constraint to shared_context.user_id
      await client.query(`
        ALTER TABLE shared_context
        ALTER COLUMN user_id SET NOT NULL
      `);
      console.log('\nAdded NOT NULL constraint to shared_context.user_id');
    } catch (error) {
      if ((error as Error).message.includes('already')) {
        console.log('\nNOT NULL constraint already exists on shared_context.user_id');
      } else {
        throw error;
      }
    }

    try {
      // Try to add NOT NULL constraint to context_history.user_id
      await client.query(`
        ALTER TABLE context_history
        ALTER COLUMN user_id SET NOT NULL
      `);
      console.log('Added NOT NULL constraint to context_history.user_id');
    } catch (error) {
      if ((error as Error).message.includes('already')) {
        console.log('NOT NULL constraint already exists on context_history.user_id');
      } else {
        throw error;
      }
    }

    // Step 6: Add unique constraint on (user_id, key) for shared_context
    // First drop the old PRIMARY KEY and add new composite one
    try {
      // Check if we need to change the primary key
      const pkResult = await client.query(`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'shared_context'
        AND constraint_type = 'PRIMARY KEY'
      `);

      if (pkResult.rows.length > 0) {
        const pkName = pkResult.rows[0].constraint_name;

        // Check if it's already a composite key
        const columnCount = await client.query(`
          SELECT COUNT(*)
          FROM information_schema.key_column_usage
          WHERE constraint_name = $1
        `, [pkName]);

        if (parseInt(columnCount.rows[0].count) === 1) {
          // It's a single-column PK, we need to change it
          await client.query(`ALTER TABLE shared_context DROP CONSTRAINT ${pkName}`);
          await client.query(`
            ALTER TABLE shared_context
            ADD PRIMARY KEY (user_id, key)
          `);
          console.log('Changed primary key to (user_id, key)');
        } else {
          console.log('Primary key is already composite (user_id, key)');
        }
      }
    } catch (error) {
      console.error('Error modifying primary key:', error);
      throw error;
    }

    // Step 7: Add foreign key constraints
    try {
      await client.query(`
        ALTER TABLE shared_context
        ADD CONSTRAINT fk_shared_context_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('Added foreign key constraint on shared_context.user_id');
    } catch (error) {
      if ((error as Error).message.includes('already exists')) {
        console.log('Foreign key constraint already exists on shared_context.user_id');
      } else {
        throw error;
      }
    }

    try {
      await client.query(`
        ALTER TABLE context_history
        ADD CONSTRAINT fk_context_history_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      `);
      console.log('Added foreign key constraint on context_history.user_id');
    } catch (error) {
      if ((error as Error).message.includes('already exists')) {
        console.log('Foreign key constraint already exists on context_history.user_id');
      } else {
        throw error;
      }
    }

    await client.query('COMMIT');

    console.log('\n=== Migration completed successfully! ===\n');
    console.log('Summary:');
    console.log(`  - User: ${USER_ID} (${USER_EMAIL})`);
    console.log(`  - API key migrated (use same MCP_AUTH_TOKEN)`);
    console.log(`  - All existing data assigned to ${USER_ID}`);
    console.log(`  - Primary key changed to (user_id, key)`);
    console.log('\nYou can now use the URL format: /mcp/<your-api-key>');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed, rolling back:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch((error) => {
  console.error('Migration error:', error);
  process.exit(1);
});
