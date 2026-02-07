import 'dotenv/config';
import http from 'http';
import { testConnection, closePool } from './db/client.js';
import { runMigrations } from './db/migrations.js';
import { initializeServer, cleanupSessions } from './transport/http.js';

// Constants
const DEFAULT_PORT = 3000;
const SHUTDOWN_TIMEOUT_MS = 30000; // 30 seconds

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

  // Check for Clerk env vars (warn if missing, don't fail)
  if (!process.env.CLERK_SECRET_KEY) {
    console.warn('[startup] CLERK_SECRET_KEY not set - Clerk auth will not work');
  }
  if (!process.env.CLERK_PUBLISHABLE_KEY) {
    console.warn('[startup] CLERK_PUBLISHABLE_KEY not set - Clerk auth metadata endpoints will not work');
  }
  if (process.env.ADMIN_EMAIL) {
    console.log('[startup] ADMIN_EMAIL configured:', process.env.ADMIN_EMAIL);
  }

  console.log('[startup] Environment validation passed');
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

  // Step 4: Initialize HTTP server with MCP tools
  console.log('[startup] Initializing HTTP server...');
  const app = initializeServer();

  // Step 5: Start listening
  const port = parseInt(process.env.PORT || String(DEFAULT_PORT), 10);
  const server = http.createServer(app);

  server.listen(port, () => {
    console.log('[startup] Server listening on port', port);
    console.log('[startup] Health check: http://localhost:' + port + '/health');
    console.log('[startup] MCP endpoint: http://localhost:' + port + '/mcp (Clerk OAuth)');
    console.log('[startup] MCP endpoint: http://localhost:' + port + '/claude-code/mcp (API key header)');
    console.log('[startup] Ready to accept connections');
  });

  // Step 6: Set up graceful shutdown
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
