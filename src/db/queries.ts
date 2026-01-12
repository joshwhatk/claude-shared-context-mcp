import crypto from 'crypto';
import { query, getClient } from './client.js';

// Type definitions for query results
export interface ContextEntry {
  key: string;
  content: string;
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

export interface ContextKeyInfo {
  key: string;
  updated_at: Date;
}

export interface ContextHistoryEntry {
  id: number;
  key: string;
  content: string;
  user_id: string;
  action: 'create' | 'update' | 'delete';
  changed_at: Date;
}

// User and API key types
export interface User {
  id: string;
  email: string;
  auth_provider: string;
  created_at: Date;
  updated_at: Date;
}

export interface ApiKey {
  key_hash: string;
  user_id: string;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
}

// ============================================
// API Key and User Functions
// ============================================

/**
 * Hash an API key for secure storage
 * Uses SHA-256 - keys are stored hashed, never in plaintext
 */
export function hashApiKey(plainKey: string): string {
  return crypto.createHash('sha256').update(plainKey).digest('hex');
}

/**
 * Look up user ID by API key
 * Also updates last_used_at timestamp (fire-and-forget)
 * @returns user_id if valid, null if not found
 */
export async function getUserByApiKey(plainKey: string): Promise<string | null> {
  const keyHash = hashApiKey(plainKey);

  const result = await query<{ user_id: string }>(
    'SELECT user_id FROM api_keys WHERE key_hash = $1',
    [keyHash]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Update last_used_at (fire-and-forget, don't await)
  query(
    'UPDATE api_keys SET last_used_at = NOW() WHERE key_hash = $1',
    [keyHash]
  ).catch((err) => console.error('[queries] Failed to update last_used_at:', err));

  return result.rows[0].user_id;
}

/**
 * Create a new user (admin-only function)
 * @returns The created user
 */
export async function createUser(
  id: string,
  email: string,
  authProvider = 'manual'
): Promise<User> {
  const result = await query<User>(
    `INSERT INTO users (id, email, auth_provider, created_at, updated_at)
     VALUES ($1, $2, $3, NOW(), NOW())
     RETURNING *`,
    [id, email, authProvider]
  );
  return result.rows[0];
}

/**
 * Get a user by ID
 * @returns The user or null if not found
 */
export async function getUserById(id: string): Promise<User | null> {
  const result = await query<User>(
    'SELECT * FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
}

/**
 * Create a new API key for a user (admin-only function)
 * @returns Object with plainKey (show once!) and keyHash
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<{ plainKey: string; keyHash: string }> {
  // Generate secure random key (32 bytes = 256 bits)
  const plainKey = crypto.randomBytes(32).toString('base64url');
  const keyHash = hashApiKey(plainKey);

  await query(
    `INSERT INTO api_keys (key_hash, user_id, name, created_at)
     VALUES ($1, $2, $3, NOW())`,
    [keyHash, userId, name]
  );

  return { plainKey, keyHash };
}

/**
 * List all API keys for a user (without revealing the actual keys)
 */
export async function listUserApiKeys(userId: string): Promise<Omit<ApiKey, 'key_hash'>[]> {
  const result = await query<ApiKey>(
    `SELECT user_id, name, created_at, last_used_at
     FROM api_keys
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId]
  );
  return result.rows;
}

/**
 * Delete an API key by hash
 */
export async function deleteApiKey(keyHash: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM api_keys WHERE key_hash = $1',
    [keyHash]
  );
  return (result.rowCount ?? 0) > 0;
}

// ============================================
// Context CRUD Functions (Multi-tenant)
// ============================================

/**
 * Get a single context entry by key for a specific user
 * @returns The context entry or null if not found
 */
export async function getContext(userId: string, key: string): Promise<ContextEntry | null> {
  const result = await query<ContextEntry>(
    `SELECT key, content, user_id, created_at, updated_at
     FROM shared_context
     WHERE user_id = $1 AND key = $2`,
    [userId, key]
  );

  return result.rows[0] || null;
}

/**
 * Create or update a context entry for a specific user (UPSERT)
 * Records the action in context_history within a transaction
 * @returns The updated context entry
 */
export async function setContext(userId: string, key: string, content: string): Promise<ContextEntry> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if entry exists for this user to determine action type
    const existingResult = await client.query<{ key: string }>(
      'SELECT key FROM shared_context WHERE user_id = $1 AND key = $2',
      [userId, key]
    );
    const action = existingResult.rows.length > 0 ? 'update' : 'create';

    // Perform UPSERT (conflict on user_id + key combination)
    const upsertResult = await client.query<ContextEntry>(
      `INSERT INTO shared_context (user_id, key, content, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id, key) DO UPDATE SET
         content = EXCLUDED.content,
         updated_at = NOW()
       RETURNING key, content, user_id, created_at, updated_at`,
      [userId, key, content]
    );

    // Record in history with user_id
    await client.query(
      `INSERT INTO context_history (user_id, key, content, action, changed_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [userId, key, content, action]
    );

    await client.query('COMMIT');

    return upsertResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[queries] setContext failed:', { userId, key, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a context entry by key for a specific user
 * Records the deletion in context_history within a transaction
 * @returns true if deleted, false if not found
 */
export async function deleteContext(userId: string, key: string): Promise<boolean> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get the current content for history (if exists) - filter by user
    const existingResult = await client.query<{ content: string }>(
      'SELECT content FROM shared_context WHERE user_id = $1 AND key = $2',
      [userId, key]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const content = existingResult.rows[0].content;

    // Delete the entry (filter by user for security)
    await client.query(
      'DELETE FROM shared_context WHERE user_id = $1 AND key = $2',
      [userId, key]
    );

    // Record deletion in history with user_id
    await client.query(
      `INSERT INTO context_history (user_id, key, content, action, changed_at)
       VALUES ($1, $2, $3, 'delete', NOW())`,
      [userId, key, content]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[queries] deleteContext failed:', { userId, key, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * List context keys with metadata for a specific user
 * @param userId - The user ID
 * @param limit - Maximum number of results (default: 50, max: 200)
 * @param search - Optional search pattern (filters keys containing the search string)
 * @returns Array of key info objects sorted by updated_at DESC
 */
export async function listContextKeys(
  userId: string,
  limit = 50,
  search?: string
): Promise<ContextKeyInfo[]> {
  // Enforce limits
  const safeLimit = Math.min(Math.max(1, limit), 200);

  let queryText: string;
  let params: unknown[];

  if (search) {
    // Escape LIKE wildcards in search string to prevent SQL injection
    const escapedSearch = search
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');

    queryText = `
      SELECT key, updated_at
      FROM shared_context
      WHERE user_id = $1 AND key ILIKE $2
      ORDER BY updated_at DESC
      LIMIT $3
    `;
    params = [userId, `%${escapedSearch}%`, safeLimit];
  } else {
    queryText = `
      SELECT key, updated_at
      FROM shared_context
      WHERE user_id = $1
      ORDER BY updated_at DESC
      LIMIT $2
    `;
    params = [userId, safeLimit];
  }

  const result = await query<ContextKeyInfo>(queryText, params);
  return result.rows;
}

/**
 * Get all context entries with content for a specific user
 * @param userId - The user ID
 * @param limit - Maximum number of results (default: 20, max: 50)
 * @returns Array of full context entries sorted by updated_at DESC
 */
export async function getAllContext(userId: string, limit = 20): Promise<ContextEntry[]> {
  // Enforce limits (lower than listContextKeys since we're returning content)
  const safeLimit = Math.min(Math.max(1, limit), 50);

  const result = await query<ContextEntry>(
    `SELECT key, content, user_id, created_at, updated_at
     FROM shared_context
     WHERE user_id = $1
     ORDER BY updated_at DESC
     LIMIT $2`,
    [userId, safeLimit]
  );

  return result.rows;
}

/**
 * Get history entries for a specific key and user (useful for debugging)
 * @param userId - The user ID
 * @param key - The context key
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of history entries sorted by changed_at DESC
 */
export async function getContextHistory(
  userId: string,
  key: string,
  limit = 10
): Promise<ContextHistoryEntry[]> {
  const result = await query<ContextHistoryEntry>(
    `SELECT id, key, content, user_id, action, changed_at
     FROM context_history
     WHERE user_id = $1 AND key = $2
     ORDER BY changed_at DESC
     LIMIT $3`,
    [userId, key, limit]
  );

  return result.rows;
}
