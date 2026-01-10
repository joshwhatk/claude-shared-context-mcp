import { query, getClient } from './client.js';

// Type definitions for query results
export interface ContextEntry {
  key: string;
  content: string;
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
  action: 'create' | 'update' | 'delete';
  changed_at: Date;
}

/**
 * Get a single context entry by key
 * @returns The context entry or null if not found
 */
export async function getContext(key: string): Promise<ContextEntry | null> {
  const result = await query<ContextEntry>(
    'SELECT key, content, created_at, updated_at FROM shared_context WHERE key = $1',
    [key]
  );

  return result.rows[0] || null;
}

/**
 * Create or update a context entry (UPSERT)
 * Records the action in context_history within a transaction
 * @returns The updated context entry
 */
export async function setContext(key: string, content: string): Promise<ContextEntry> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Check if entry exists to determine action type
    const existingResult = await client.query<{ key: string }>(
      'SELECT key FROM shared_context WHERE key = $1',
      [key]
    );
    const action = existingResult.rows.length > 0 ? 'update' : 'create';

    // Perform UPSERT
    const upsertResult = await client.query<ContextEntry>(
      `INSERT INTO shared_context (key, content, created_at, updated_at)
       VALUES ($1, $2, NOW(), NOW())
       ON CONFLICT (key) DO UPDATE SET
         content = EXCLUDED.content,
         updated_at = NOW()
       RETURNING key, content, created_at, updated_at`,
      [key, content]
    );

    // Record in history
    await client.query(
      `INSERT INTO context_history (key, content, action, changed_at)
       VALUES ($1, $2, $3, NOW())`,
      [key, content, action]
    );

    await client.query('COMMIT');

    return upsertResult.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[queries] setContext failed:', { key, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Delete a context entry by key
 * Records the deletion in context_history within a transaction
 * @returns true if deleted, false if not found
 */
export async function deleteContext(key: string): Promise<boolean> {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Get the current content for history (if exists)
    const existingResult = await client.query<{ content: string }>(
      'SELECT content FROM shared_context WHERE key = $1',
      [key]
    );

    if (existingResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const content = existingResult.rows[0].content;

    // Delete the entry
    await client.query('DELETE FROM shared_context WHERE key = $1', [key]);

    // Record deletion in history
    await client.query(
      `INSERT INTO context_history (key, content, action, changed_at)
       VALUES ($1, $2, 'delete', NOW())`,
      [key, content]
    );

    await client.query('COMMIT');
    return true;
  } catch (err) {
    await client.query('ROLLBACK');
    const error = err instanceof Error ? err : new Error(String(err));
    console.error('[queries] deleteContext failed:', { key, error: error.message });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * List context keys with metadata
 * @param limit - Maximum number of results (default: 50, max: 200)
 * @param search - Optional search pattern (filters keys containing the search string)
 * @returns Array of key info objects sorted by updated_at DESC
 */
export async function listContextKeys(
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
      WHERE key ILIKE $1
      ORDER BY updated_at DESC
      LIMIT $2
    `;
    params = [`%${escapedSearch}%`, safeLimit];
  } else {
    queryText = `
      SELECT key, updated_at
      FROM shared_context
      ORDER BY updated_at DESC
      LIMIT $1
    `;
    params = [safeLimit];
  }

  const result = await query<ContextKeyInfo>(queryText, params);
  return result.rows;
}

/**
 * Get all context entries with content
 * @param limit - Maximum number of results (default: 20, max: 50)
 * @returns Array of full context entries sorted by updated_at DESC
 */
export async function getAllContext(limit = 20): Promise<ContextEntry[]> {
  // Enforce limits (lower than listContextKeys since we're returning content)
  const safeLimit = Math.min(Math.max(1, limit), 50);

  const result = await query<ContextEntry>(
    `SELECT key, content, created_at, updated_at
     FROM shared_context
     ORDER BY updated_at DESC
     LIMIT $1`,
    [safeLimit]
  );

  return result.rows;
}

/**
 * Get history entries for a specific key (useful for debugging)
 * @param key - The context key
 * @param limit - Maximum number of results (default: 10)
 * @returns Array of history entries sorted by changed_at DESC
 */
export async function getContextHistory(
  key: string,
  limit = 10
): Promise<ContextHistoryEntry[]> {
  const result = await query<ContextHistoryEntry>(
    `SELECT id, key, content, action, changed_at
     FROM context_history
     WHERE key = $1
     ORDER BY changed_at DESC
     LIMIT $2`,
    [key, limit]
  );

  return result.rows;
}
