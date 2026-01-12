import 'dotenv/config';
import http from 'http';
import crypto from 'crypto';
import { testConnection, closePool, query } from './db/client.js';
import { runMigrations } from './db/migrations.js';
import { initializeServer, cleanupSessions } from './transport/http.js';

// Constants
const DEFAULT_PORT = 3000;
const SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds

// Default user for initial setup (when MCP_AUTH_TOKEN is provided)
const DEFAULT_USER_ID = 'joshwhatk';
const DEFAULT_USER_EMAIL = 'josh@joshwhatk.com';

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = ['DATABASE_URL'];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error('[startup] Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }

  // MCP_AUTH_TOKEN is optional - only used for initial migration
  if (process.env.MCP_AUTH_TOKEN) {
    console.log('[startup] MCP_AUTH_TOKEN found - will migrate to database if needed');
  }

  console.log('[startup] Environment validation passed');
}

/**
 * Hash an API key for storage
 */
function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}

/**
 * Migrate MCP_AUTH_TOKEN to database (idempotent)
 * Creates the default user and API key if they don't exist
 */
async function migrateAuthToken(): Promise<void> {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    console.log('[startup] No MCP_AUTH_TOKEN - skipping token migration');
    return;
  }

  try {
    // Check if user exists
    const userResult = await query<{ id: string }>(
      'SELECT id FROM users WHERE id = $1',
      [DEFAULT_USER_ID]
    );

    if (userResult.rows.length === 0) {
      // Create user
      await query(
        `INSERT INTO users (id, email, auth_provider, created_at, updated_at)
         VALUES ($1, $2, 'manual', NOW(), NOW())`,
        [DEFAULT_USER_ID, DEFAULT_USER_EMAIL]
      );
      console.log('[startup] Created default user:', DEFAULT_USER_ID);
    }

    // Check if API key exists
    const keyHash = hashApiKey(token);
    const keyResult = await query<{ key_hash: string }>(
      'SELECT key_hash FROM api_keys WHERE key_hash = $1',
      [keyHash]
    );

    if (keyResult.rows.length === 0) {
      // Create API key
      await query(
        `INSERT INTO api_keys (key_hash, user_id, name, created_at)
         VALUES ($1, $2, 'primary', NOW())`,
        [keyHash, DEFAULT_USER_ID]
      );
      console.log('[startup] Migrated MCP_AUTH_TOKEN to api_keys table');
    }

    // Migrate any orphaned data (user_id IS NULL)
    const orphanedContext = await query<{ count: string }>(
      'SELECT COUNT(*) FROM shared_context WHERE user_id IS NULL'
    );
    if (parseInt(orphanedContext.rows[0].count) > 0) {
      await query(
        'UPDATE shared_context SET user_id = $1 WHERE user_id IS NULL',
        [DEFAULT_USER_ID]
      );
      console.log('[startup] Assigned orphaned context entries to', DEFAULT_USER_ID);
    }

    const orphanedHistory = await query<{ count: string }>(
      'SELECT COUNT(*) FROM context_history WHERE user_id IS NULL'
    );
    if (parseInt(orphanedHistory.rows[0].count) > 0) {
      await query(
        'UPDATE context_history SET user_id = $1 WHERE user_id IS NULL',
        [DEFAULT_USER_ID]
      );
      console.log('[startup] Assigned orphaned history entries to', DEFAULT_USER_ID);
    }

  } catch (error) {
    console.error('[startup] Error migrating auth token:', error);
    // Don't fail startup - the server can still work if users exist
  }
}

/**
 * Main application entry point
 */
async function main(): Promise<void> {
  console.log('[startup] MCP Shared Context Server starting...');
  console.log('[startup] Environment:', process.env.NODE_ENV || 'development');

  // Step 1: Validate environment
  validateEnvironment();

  // Step 2: Test database connection
  console.log('[startup] Testing database connection...');
  try {
    await testConnection();
  } catch (error) {
    console.error('[startup] Database connection failed:', error);
    process.exit(1);
  }

  // Step 3: Run database migrations
  console.log('[startup] Running database migrations...');
  try {
    await runMigrations();
  } catch (error) {
    console.error('[startup] Migration failed:', error);
    process.exit(1);
  }

  // Step 4: Migrate auth token to database (if MCP_AUTH_TOKEN is set)
  await migrateAuthToken();

  // Step 5: Initialize HTTP server with MCP tools
  console.log('[startup] Initializing HTTP server...');
  const app = initializeServer();

  // Step 6: Start listening
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log('[startup] Server listening on port', port);
    console.log('[startup] Health check: http://localhost:' + port + '/health');
    console.log('[startup] MCP endpoint: http://localhost:' + port + '/mcp/:apiKey');
    console.log('[startup] Ready to accept connections');
  });

  // Step 7: Set up graceful shutdown
  setupGracefulShutdown(server);
}

/**
 * Set up graceful shutdown handlers
 */
function setupGracefulShutdown(server: http.Server): void {
  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      console.log('[shutdown] Already shutting down, please wait...');
      return;
    }

    isShuttingDown = true;
    console.log(`[shutdown] Received ${signal}, starting graceful shutdown...`);

    // Create a timeout to force exit if shutdown takes too long
    const forceExitTimeout = setTimeout(() => {
      console.error('[shutdown] Shutdown timed out, forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    try {
      // Stop accepting new connections
      console.log('[shutdown] Stopping HTTP server...');
      await new Promise<void>((resolve, reject) => {
        server.close((err) => {
          if (err) {
            console.error('[shutdown] Error closing server:', err);
            reject(err);
          } else {
            console.log('[shutdown] HTTP server closed');
            resolve();
          }
        });
      });

      // Clean up MCP sessions
      console.log('[shutdown] Cleaning up MCP sessions...');
      cleanupSessions();

      // Close database pool
      console.log('[shutdown] Closing database pool...');
      await closePool();

      console.log('[shutdown] Graceful shutdown complete');
      clearTimeout(forceExitTimeout);
      process.exit(0);
    } catch (error) {
      console.error('[shutdown] Error during shutdown:', error);
      clearTimeout(forceExitTimeout);
      process.exit(1);
    }
  }

  // Handle shutdown signals
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[error] Uncaught exception:', error);
    shutdown('uncaughtException');
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[error] Unhandled rejection at:', promise, 'reason:', reason);
    shutdown('unhandledRejection');
  });
}

// Start the application
main().catch((error) => {
  console.error('[startup] Fatal error:', error);
  process.exit(1);
});
