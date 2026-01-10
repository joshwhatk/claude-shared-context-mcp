import { describe, it, expect } from 'vitest';
import {
  fixtures,
  getHistory,
  countHistoryEntries,
  wait,
} from '../helpers.js';
import {
  setContext,
  deleteContext,
} from '../../src/db/queries.js';

describe('context_history', () => {
  describe('create action', () => {
    it('records create action when new entry is created', async () => {
      await setContext(fixtures.validKey, fixtures.validContent);

      const history = await getHistory(fixtures.validKey);

      expect(history.length).toBe(1);
      expect(history[0].action).toBe('create');
      expect(history[0].key).toBe(fixtures.validKey);
      expect(history[0].content).toBe(fixtures.validContent);
    });

    it('records create with correct timestamp', async () => {
      const before = new Date();
      await setContext(fixtures.validKey, fixtures.validContent);
      const after = new Date();

      const history = await getHistory(fixtures.validKey);

      expect(history[0].changed_at.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(history[0].changed_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('update action', () => {
    it('records update action when existing entry is modified', async () => {
      await setContext(fixtures.validKey, fixtures.validContent);
      await wait(10);
      await setContext(fixtures.validKey, fixtures.validContent2);

      const history = await getHistory(fixtures.validKey);

      expect(history.length).toBe(2);
      // Most recent first
      expect(history[0].action).toBe('update');
      expect(history[0].content).toBe(fixtures.validContent2);
      expect(history[1].action).toBe('create');
      expect(history[1].content).toBe(fixtures.validContent);
    });

    it('records multiple updates correctly', async () => {
      await setContext(fixtures.validKey, 'Version 1');
      await wait(10);
      await setContext(fixtures.validKey, 'Version 2');
      await wait(10);
      await setContext(fixtures.validKey, 'Version 3');

      const history = await getHistory(fixtures.validKey);

      expect(history.length).toBe(3);
      expect(history[0].content).toBe('Version 3');
      expect(history[0].action).toBe('update');
      expect(history[1].content).toBe('Version 2');
      expect(history[1].action).toBe('update');
      expect(history[2].content).toBe('Version 1');
      expect(history[2].action).toBe('create');
    });
  });

  describe('delete action', () => {
    it('records delete action when entry is deleted', async () => {
      await setContext(fixtures.validKey, fixtures.validContent);
      await wait(10);
      await deleteContext(fixtures.validKey);

      const history = await getHistory(fixtures.validKey);

      expect(history.length).toBe(2);
      expect(history[0].action).toBe('delete');
      expect(history[0].content).toBe(fixtures.validContent);
      expect(history[1].action).toBe('create');
    });

    it('records content at time of deletion', async () => {
      await setContext(fixtures.validKey, fixtures.validContent);
      await wait(10);
      await setContext(fixtures.validKey, fixtures.validContent2);
      await wait(10);
      await deleteContext(fixtures.validKey);

      const history = await getHistory(fixtures.validKey);

      expect(history.length).toBe(3);
      // Delete should record the final content (validContent2)
      expect(history[0].action).toBe('delete');
      expect(history[0].content).toBe(fixtures.validContent2);
    });

    it('does not record delete for non-existent key', async () => {
      const initialCount = await countHistoryEntries();

      await deleteContext('non-existent-key');

      const finalCount = await countHistoryEntries();
      expect(finalCount).toBe(initialCount);
    });
  });

  describe('history ordering', () => {
    it('returns history in reverse chronological order', async () => {
      await setContext(fixtures.validKey, 'First');
      await wait(20);
      await setContext(fixtures.validKey, 'Second');
      await wait(20);
      await setContext(fixtures.validKey, 'Third');

      const history = await getHistory(fixtures.validKey);

      expect(history[0].content).toBe('Third');
      expect(history[1].content).toBe('Second');
      expect(history[2].content).toBe('First');

      // Timestamps should be in descending order
      expect(history[0].changed_at.getTime()).toBeGreaterThan(history[1].changed_at.getTime());
      expect(history[1].changed_at.getTime()).toBeGreaterThan(history[2].changed_at.getTime());
    });

    it('respects limit parameter', async () => {
      await setContext(fixtures.validKey, 'V1');
      await wait(10);
      await setContext(fixtures.validKey, 'V2');
      await wait(10);
      await setContext(fixtures.validKey, 'V3');
      await wait(10);
      await setContext(fixtures.validKey, 'V4');
      await wait(10);
      await setContext(fixtures.validKey, 'V5');

      const history = await getHistory(fixtures.validKey, 3);

      expect(history.length).toBe(3);
      // Should return the 3 most recent
      expect(history[0].content).toBe('V5');
      expect(history[1].content).toBe('V4');
      expect(history[2].content).toBe('V3');
    });
  });

  describe('cross-key isolation', () => {
    it('maintains separate history for different keys', async () => {
      await setContext('key-a', 'Content A1');
      await wait(10);
      await setContext('key-a', 'Content A2');
      await wait(10);
      await setContext('key-b', 'Content B1');

      const historyA = await getHistory('key-a');
      const historyB = await getHistory('key-b');

      expect(historyA.length).toBe(2);
      expect(historyB.length).toBe(1);

      expect(historyA.every((h) => h.key === 'key-a')).toBe(true);
      expect(historyB.every((h) => h.key === 'key-b')).toBe(true);
    });
  });

  describe('transaction integrity', () => {
    it('maintains atomic history with main data', async () => {
      // Create and immediately verify both tables are updated
      await setContext(fixtures.validKey, fixtures.validContent);

      const history = await getHistory(fixtures.validKey);
      const historyCount = await countHistoryEntries();

      expect(history.length).toBe(1);
      expect(historyCount).toBe(1);
    });

    it('full lifecycle maintains history integrity', async () => {
      // Create
      await setContext(fixtures.validKey, 'Created');
      await wait(10);

      // Update twice
      await setContext(fixtures.validKey, 'Updated 1');
      await wait(10);
      await setContext(fixtures.validKey, 'Updated 2');
      await wait(10);

      // Delete
      await deleteContext(fixtures.validKey);

      const history = await getHistory(fixtures.validKey);

      expect(history.length).toBe(4);
      expect(history[0].action).toBe('delete');
      expect(history[1].action).toBe('update');
      expect(history[2].action).toBe('update');
      expect(history[3].action).toBe('create');
    });
  });
});
