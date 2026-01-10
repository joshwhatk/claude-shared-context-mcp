import { beforeAll, afterAll, beforeEach } from 'vitest';
import { getPool, closePool } from '../src/db/client.js';
import { runMigrations } from '../src/db/migrations.js';

// Use TEST_DATABASE_URL if available, otherwise fall back to DATABASE_URL
const testDatabaseUrl = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL;

if (!testDatabaseUrl) {
  throw new Error('TEST_DATABASE_URL or DATABASE_URL environment variable is required for tests');
}

// Override DATABASE_URL for tests
process.env.DATABASE_URL = testDatabaseUrl;

// Also set a dummy auth token for tests
process.env.MCP_AUTH_TOKEN = process.env.MCP_AUTH_TOKEN || 'test-token-for-integration-tests';

/**
 * Global test setup - runs once before all tests
 */
beforeAll(async () => {
  console.log('[test-setup] Starting test setup...');
  console.log('[test-setup] Using database:', testDatabaseUrl?.replace(/\/\/.*@/, '//***@'));

  // Run migrations to ensure schema exists
  await runMigrations();
  console.log('[test-setup] Migrations complete');
});

/**
 * Clean up before each test - truncate tables
 */
beforeEach(async () => {
  const pool = getPool();

  // Truncate tables to ensure clean state
  // Using TRUNCATE with CASCADE to handle foreign key constraints
  await pool.query('TRUNCATE TABLE shared_context, context_history RESTART IDENTITY');
});

/**
 * Global test teardown - runs once after all tests
 */
afterAll(async () => {
  console.log('[test-setup] Cleaning up...');
  await closePool();
  console.log('[test-setup] Test cleanup complete');
});
