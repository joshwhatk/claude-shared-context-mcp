import { getPool } from '../src/db/client.js';
import {
  getContext,
  setContext,
  deleteContext,
  listContextKeys,
  getAllContext,
  getContextHistory,
  type ContextEntry,
  type ContextKeyInfo,
  type ContextHistoryEntry,
} from '../src/db/queries.js';

/**
 * Test fixtures for common test data
 */
export const fixtures = {
  validKey: 'test-key-123',
  validKey2: 'another-test-key',
  validKey3: 'third.test.key',
  validContent: 'This is test content for the shared context.',
  validContent2: 'Updated content for testing.',
  largeContent: 'x'.repeat(50000), // 50KB - within limit
  oversizedContent: 'x'.repeat(110000), // 110KB - exceeds 100KB limit
  invalidKeyWithSpaces: 'invalid key with spaces',
  invalidKeyWithSpecialChars: 'invalid@key#$%',
  invalidKeyTooLong: 'a'.repeat(300), // 300 chars - exceeds 255 limit
};

/**
 * Helper to directly query the database for verification
 */
export async function queryDatabase<T>(
  sql: string,
  params: unknown[] = []
): Promise<T[]> {
  const pool = getPool();
  const result = await pool.query(sql, params);
  return result.rows as T[];
}

/**
 * Helper to get raw context entry from database
 */
export async function getRawContextEntry(key: string): Promise<ContextEntry | null> {
  return getContext(key);
}

/**
 * Helper to create a context entry directly
 */
export async function createContextEntry(
  key: string,
  content: string
): Promise<ContextEntry> {
  return setContext(key, content);
}

/**
 * Helper to delete a context entry directly
 */
export async function deleteContextEntry(key: string): Promise<boolean> {
  return deleteContext(key);
}

/**
 * Helper to list context keys directly
 */
export async function listKeys(
  limit?: number,
  search?: string
): Promise<ContextKeyInfo[]> {
  return listContextKeys(limit, search);
}

/**
 * Helper to get all context entries directly
 */
export async function getAllEntries(limit?: number): Promise<ContextEntry[]> {
  return getAllContext(limit);
}

/**
 * Helper to get context history for a key
 */
export async function getHistory(
  key: string,
  limit?: number
): Promise<ContextHistoryEntry[]> {
  return getContextHistory(key, limit);
}

/**
 * Helper to count entries in shared_context table
 */
export async function countContextEntries(): Promise<number> {
  const result = await queryDatabase<{ count: string }>(
    'SELECT COUNT(*) as count FROM shared_context'
  );
  return parseInt(result[0].count, 10);
}

/**
 * Helper to count entries in context_history table
 */
export async function countHistoryEntries(): Promise<number> {
  const result = await queryDatabase<{ count: string }>(
    'SELECT COUNT(*) as count FROM context_history'
  );
  return parseInt(result[0].count, 10);
}

/**
 * Helper to create multiple test entries
 */
export async function createMultipleEntries(
  count: number,
  prefix = 'test-entry'
): Promise<ContextEntry[]> {
  const entries: ContextEntry[] = [];

  for (let i = 0; i < count; i++) {
    const entry = await createContextEntry(
      `${prefix}-${i}`,
      `Content for entry ${i}`
    );
    entries.push(entry);

    // Small delay to ensure different timestamps
    await new Promise((resolve) => setTimeout(resolve, 10));
  }

  return entries;
}

/**
 * Helper to wait for a short time (useful for timestamp tests)
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
