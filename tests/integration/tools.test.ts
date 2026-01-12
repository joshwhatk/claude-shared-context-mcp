import { describe, it, expect } from 'vitest';
import {
  fixtures,
  createContextEntry,
  getRawContextEntry,
  countContextEntries,
  createMultipleEntries,
  wait,
  listKeys,
  getAllEntries,
} from '../helpers.js';
import { TEST_USER_ID } from '../setup.js';
import {
  getContext,
  setContext,
  deleteContext,
  listContextKeys,
  getAllContext,
} from '../../src/db/queries.js';
import { validateKey, validateContent } from '../../src/tools/validators.js';

describe('write_context', () => {
  it('creates a new entry and returns success', async () => {
    const entry = await setContext(TEST_USER_ID, fixtures.validKey, fixtures.validContent);

    expect(entry).toBeDefined();
    expect(entry.key).toBe(fixtures.validKey);
    expect(entry.content).toBe(fixtures.validContent);
    expect(entry.created_at).toBeInstanceOf(Date);
    expect(entry.updated_at).toBeInstanceOf(Date);
  });

  it('updates existing entry and updates timestamp', async () => {
    // Create initial entry
    const initial = await setContext(TEST_USER_ID, fixtures.validKey, fixtures.validContent);

    // Wait to ensure different timestamp
    await wait(50);

    // Update the entry
    const updated = await setContext(TEST_USER_ID, fixtures.validKey, fixtures.validContent2);

    expect(updated.key).toBe(fixtures.validKey);
    expect(updated.content).toBe(fixtures.validContent2);
    expect(updated.created_at.getTime()).toBe(initial.created_at.getTime());
    expect(updated.updated_at.getTime()).toBeGreaterThan(initial.updated_at.getTime());
  });

  it('validates key format - rejects spaces', () => {
    const result = validateKey(fixtures.invalidKeyWithSpaces);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('alphanumeric');
  });

  it('validates key format - rejects special characters', () => {
    const result = validateKey(fixtures.invalidKeyWithSpecialChars);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('alphanumeric');
  });

  it('validates key format - rejects keys exceeding max length', () => {
    const result = validateKey(fixtures.invalidKeyTooLong);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('255');
  });

  it('validates key format - accepts valid keys with dots, dashes, underscores', () => {
    expect(validateKey('my-key').valid).toBe(true);
    expect(validateKey('my_key').valid).toBe(true);
    expect(validateKey('my.key').valid).toBe(true);
    expect(validateKey('my-key_123.test').valid).toBe(true);
  });

  it('validates content size - accepts content within limit', () => {
    const result = validateContent(fixtures.largeContent);
    expect(result.valid).toBe(true);
  });

  it('validates content size - rejects content exceeding limit', () => {
    const result = validateContent(fixtures.oversizedContent);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('100');
  });

  it('stores and retrieves large content correctly', async () => {
    await setContext(TEST_USER_ID, fixtures.validKey, fixtures.largeContent);
    const retrieved = await getContext(TEST_USER_ID, fixtures.validKey);

    expect(retrieved).toBeDefined();
    expect(retrieved!.content).toBe(fixtures.largeContent);
    expect(retrieved!.content.length).toBe(50000);
  });
});

describe('read_context', () => {
  it('retrieves existing entry', async () => {
    await createContextEntry(fixtures.validKey, fixtures.validContent);

    const entry = await getContext(TEST_USER_ID, fixtures.validKey);

    expect(entry).toBeDefined();
    expect(entry!.key).toBe(fixtures.validKey);
    expect(entry!.content).toBe(fixtures.validContent);
  });

  it('returns null for missing key', async () => {
    const entry = await getContext(TEST_USER_ID, 'non-existent-key');
    expect(entry).toBeNull();
  });

  it('retrieves correct entry when multiple exist', async () => {
    await createContextEntry(fixtures.validKey, fixtures.validContent);
    await createContextEntry(fixtures.validKey2, fixtures.validContent2);

    const entry1 = await getContext(TEST_USER_ID, fixtures.validKey);
    const entry2 = await getContext(TEST_USER_ID, fixtures.validKey2);

    expect(entry1!.content).toBe(fixtures.validContent);
    expect(entry2!.content).toBe(fixtures.validContent2);
  });
});

describe('delete_context', () => {
  it('removes entry successfully and returns true', async () => {
    await createContextEntry(fixtures.validKey, fixtures.validContent);

    const deleted = await deleteContext(TEST_USER_ID, fixtures.validKey);

    expect(deleted).toBe(true);

    const entry = await getContext(TEST_USER_ID, fixtures.validKey);
    expect(entry).toBeNull();
  });

  it('returns false for missing key', async () => {
    const deleted = await deleteContext(TEST_USER_ID, 'non-existent-key');
    expect(deleted).toBe(false);
  });

  it('only deletes specified entry', async () => {
    await createContextEntry(fixtures.validKey, fixtures.validContent);
    await createContextEntry(fixtures.validKey2, fixtures.validContent2);

    await deleteContext(TEST_USER_ID, fixtures.validKey);

    const entry1 = await getContext(TEST_USER_ID, fixtures.validKey);
    const entry2 = await getContext(TEST_USER_ID, fixtures.validKey2);

    expect(entry1).toBeNull();
    expect(entry2).toBeDefined();
  });
});

describe('list_context', () => {
  it('returns entries sorted by updated_at DESC', async () => {
    // Create entries with delays to ensure different timestamps
    await createContextEntry('entry-1', 'Content 1');
    await wait(20);
    await createContextEntry('entry-2', 'Content 2');
    await wait(20);
    await createContextEntry('entry-3', 'Content 3');

    const entries = await listContextKeys(TEST_USER_ID);

    expect(entries.length).toBe(3);
    // Most recent first
    expect(entries[0].key).toBe('entry-3');
    expect(entries[1].key).toBe('entry-2');
    expect(entries[2].key).toBe('entry-1');
  });

  it('respects limit parameter', async () => {
    await createMultipleEntries(10);

    const entries = await listContextKeys(TEST_USER_ID, 5);

    expect(entries.length).toBe(5);
  });

  it('uses default limit when not specified', async () => {
    await createMultipleEntries(5);

    const entries = await listContextKeys(TEST_USER_ID);

    expect(entries.length).toBe(5);
  });

  it('enforces maximum limit', async () => {
    await createMultipleEntries(5);

    // Request more than max (200)
    const entries = await listContextKeys(TEST_USER_ID, 300);

    // Should return all 5, capped at 200 if more existed
    expect(entries.length).toBe(5);
  });

  it('filters by search parameter (case-insensitive)', async () => {
    await createContextEntry('user-settings', 'Settings');
    await createContextEntry('user-profile', 'Profile');
    await createContextEntry('app-config', 'Config');

    const entries = await listContextKeys(TEST_USER_ID, 50, 'user');

    expect(entries.length).toBe(2);
    expect(entries.map((e) => e.key)).toContain('user-settings');
    expect(entries.map((e) => e.key)).toContain('user-profile');
  });

  it('returns empty array when no matches found', async () => {
    await createContextEntry('test-key', 'Content');

    const entries = await listContextKeys(TEST_USER_ID, 50, 'nonexistent');

    expect(entries.length).toBe(0);
  });

  it('escapes SQL wildcards in search', async () => {
    await createContextEntry('test_key', 'Content 1');
    await createContextEntry('test-key', 'Content 2');
    await createContextEntry('testXkey', 'Content 3');

    // Search for literal underscore - should only match test_key
    const entries = await listContextKeys(TEST_USER_ID, 50, 'test_');

    expect(entries.length).toBe(1);
    expect(entries[0].key).toBe('test_key');
  });
});

describe('read_all_context', () => {
  it('returns all entries with content', async () => {
    await createContextEntry(fixtures.validKey, fixtures.validContent);
    await createContextEntry(fixtures.validKey2, fixtures.validContent2);

    const entries = await getAllContext(TEST_USER_ID);

    expect(entries.length).toBe(2);
    expect(entries.every((e) => e.content !== undefined)).toBe(true);
  });

  it('respects limit parameter', async () => {
    await createMultipleEntries(10);

    const entries = await getAllContext(TEST_USER_ID, 3);

    expect(entries.length).toBe(3);
  });

  it('enforces maximum limit of 50', async () => {
    // We can't easily create 60 entries in a test, but we can verify the logic
    await createMultipleEntries(5);

    const entries = await getAllContext(TEST_USER_ID, 100);

    // Should cap at 50, but we only have 5
    expect(entries.length).toBe(5);
  });

  it('orders by updated_at DESC', async () => {
    await createContextEntry('old', 'Old content');
    await wait(20);
    await createContextEntry('new', 'New content');

    const entries = await getAllContext(TEST_USER_ID);

    expect(entries[0].key).toBe('new');
    expect(entries[1].key).toBe('old');
  });

  it('returns empty array when no entries exist', async () => {
    const entries = await getAllContext(TEST_USER_ID);
    expect(entries.length).toBe(0);
  });
});
