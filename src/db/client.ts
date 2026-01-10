import pg from 'pg';

const { Pool } = pg;

// Determine if we're in production (Railway sets NODE_ENV=production)
const isProduction = process.env.NODE_ENV === 'production';

// Parse DATABASE_URL and configure SSL
function createPoolConfig(): pg.PoolConfig {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required');
  }

  return {
    connectionString,
    // Connection pool settings
    max: 10,                    // Maximum number of clients in the pool
    idleTimeoutMillis: 30000,   // Close idle clients after 30 seconds
    connectionTimeoutMillis: 10000, // Return error after 10 seconds if connection not established

    // SSL configuration
    // Railway provides valid SSL certs, so we enable strict validation in production
    ssl: isProduction
      ? { rejectUnauthorized: true }
      : false,
  };
}

// Create the pool instance
let pool: pg.Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getPool(): pg.Pool {
  if (!pool) {
    pool = new Pool(createPoolConfig());

    // Log connection errors (but don't crash the process)
    pool.on('error', (err) => {
      console.error('[db] Unexpected error on idle client:', err.message);
    });

    // Log when pool connects successfully (debug level)
    pool.on('connect', () => {
      if (process.env.LOG_LEVEL === 'debug') {
        console.log('[db] New client connected to pool');
      }
    });
  }

  return pool;
}

/**
 * Test database connectivity with retry logic
 * @param maxRetries - Number of retry attempts (default: 3)
 * @param delayMs - Delay between retries in milliseconds (default: 1000)
 */
export async function testConnection(maxRetries = 3, delayMs = 1000): Promise<void> {
  const dbPool = getPool();
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const client = await dbPool.connect();
      try {
        await client.query('SELECT 1');
        console.log('[db] Database connection successful');
        return;
      } finally {
        client.release();
      }
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      console.error(`[db] Connection attempt ${attempt}/${maxRetries} failed:`, lastError.message);

      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  throw new Error(`Failed to connect to database after ${maxRetries} attempts: ${lastError?.message}`);
}

/**
 * Close the database pool gracefully
 */
export async function closePool(): Promise<void> {
  if (pool) {
    console.log('[db] Closing database pool...');
    await pool.end();
    pool = null;
    console.log('[db] Database pool closed');
  }
}

/**
 * Execute a query with automatic client acquisition and release
 * For simple queries that don't need transactions
 */
export async function query<T extends pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  const dbPool = getPool();
  const start = Date.now();

  try {
    const result = await dbPool.query<T>(text, params);

    if (process.env.LOG_LEVEL === 'debug') {
      const duration = Date.now() - start;
      console.log('[db] Query executed', { text: text.substring(0, 50), duration, rows: result.rowCount });
    }

    return result;
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[db] Query error:', { text: text.substring(0, 50), error: error.message });
    throw error;
  }
}

/**
 * Get a client from the pool for transaction support
 * Caller is responsible for releasing the client
 */
export async function getClient(): Promise<pg.PoolClient> {
  const dbPool = getPool();
  return dbPool.connect();
}

export { pool };
