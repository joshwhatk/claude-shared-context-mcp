import 'dotenv/config';
import { beforeAll, afterAll, beforeEach } from 'vitest';
import { getPool, closePool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrations.js';
import crypto from 'crypto';

// Test user constants
export const TEST_USER_ID = 'test-user';
export const TEST_USER_EMAIL = 'test@example.com';
export const TEST_API_KEY = 'test-api-key-for-integration-tests';

// Use TEST_DATABASE_URL if available, otherwise fall back to DATABASE_URL
const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL environment variable is required for tests');
}

// Override DATABASE_URL for tests
process.env.DATABASE_URL = testDatabaseUrl;

function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}

/**
 * Global test setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('[test-setup] Starting test setup...');
  console.log('[test-setup] Using database:', testDatabaseUrl?.replace(/\/\/.*@/, '//***@'));

  // Run migrations to ensure schema exists
  await runMigrations();
  console.log('[test-setup] Migrations complete');

  // Create test user if it doesn't exist
  const pool = getPool();
  const existingUser = await pool.query('SELECT id FROM users WHERE id = $1', [TEST_USER_ID]);

  if (existingUser.rows.length === 0) {
    await pool.query(
      `INSERT INTO users (id, email, auth_provider, created_at, updated_at)
       VALUES ($1, $2, 'test', NOW(), NOW())`,
      [TEST_USER_ID, TEST_USER_EMAIL]
    );
    console.log('[test-setup] Created test user:', TEST_USER_ID);
  }

  // Create test API key if it doesn't exist
  const keyHash = hashApiKey(TEST_API_KEY);
  const existingKey = await pool.query('SELECT key_hash FROM api_keys WHERE key_hash = $1', [keyHash]);

  if (existingKey.rows.length === 0) {
    await pool.query(
      `INSERT INTO api_keys (key_hash, user_id, name, created_at)
       VALUES ($1, $2, 'test-key', NOW())`,
      [keyHash, TEST_USER_ID]
    );
    console.log('[test-setup] Created test API key');
  }
});

/**
 * Clean up before each test - truncate tables
 */
beforeEach(async () => {
  const pool = getPool();

  // Truncate context tables to ensure clean state (keep users and api_keys)
  // Using TRUNCATE with CASCADE to handle foreign key constraints
  await pool.query('TRUNCATE TABLE shared_context, context_history RESTART IDENTITY CASCADE');
});

/**
 * Global test teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('[test-setup] Cleaning up...');
  await closePool();
  console.log('[test-setup] Test cleanup complete');
});
