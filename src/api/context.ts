/**
 * REST API routes for context CRUD operations
 * Thin wrapper around existing database queries
 */

import { Router, Request, Response } from 'express';
import {
  getContext,
  setContext,
  deleteContext,
  listContextKeys,
  getAllContext,
  ContextEntry,
  ContextKeyInfo,
} from '../db/queries.js';
import { validateKey, validateContent, validateLimit } from '../tools/validators.js';

const router = Router();

// Response types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  code?: string;
}

interface ListResponse {
  entries: Array<{
    key: string;
    updated_at: string;
  }>;
  count: number;
  limit: number;
  search?: string;
}

interface ContextResponse {
  key: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * GET /api/context
 * List context items with optional search
 * Query params: limit (default 50, max 200), search (optional)
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authenticatedUserId!;
    const limit = validateLimit(
      parseInt(req.query.limit as string) || 50,
      200,
      50
    );
    const search = req.query.search as string | undefined;

    const entries = await listContextKeys(userId, limit, search);

    const response: ApiResponse<ListResponse> = {
      success: true,
      data: {
        entries: entries.map((e: ContextKeyInfo) => ({
          key: e.key,
          updated_at: e.updated_at.toISOString(),
        })),
        count: entries.length,
        limit,
        ...(search && { search }),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[api] Error listing context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list context items',
      code: 'DATABASE_ERROR',
    });
  }
});

/**
 * GET /api/context/all
 * Get all context items with full content (for list page preview)
 * Query params: limit (default 50, max 50)
 */
router.get('/all', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authenticatedUserId!;
    const limit = validateLimit(
      parseInt(req.query.limit as string) || 50,
      50,
      50
    );

    const entries = await getAllContext(userId, limit);

    const response: ApiResponse<{
      entries: ContextResponse[];
      count: number;
      limit: number;
    }> = {
      success: true,
      data: {
        entries: entries.map((e: ContextEntry) => ({
          key: e.key,
          content: e.content,
          created_at: e.created_at.toISOString(),
          updated_at: e.updated_at.toISOString(),
        })),
        count: entries.length,
        limit,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[api] Error getting all context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get context items',
      code: 'DATABASE_ERROR',
    });
  }
});

/**
 * GET /api/context/:key
 * Get a single context item by key
 */
router.get('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authenticatedUserId!;
    const { key } = req.params;

    // Validate key format
    const keyValidation = validateKey(key);
    if (!keyValidation.valid) {
      res.status(400).json({
        success: false,
        error: keyValidation.error,
        code: 'INVALID_INPUT',
      });
      return;
    }

    const entry = await getContext(userId, key);

    if (!entry) {
      res.status(404).json({
        success: false,
        error: `Context item '${key}' not found`,
        code: 'NOT_FOUND',
      });
      return;
    }

    const response: ApiResponse<ContextResponse> = {
      success: true,
      data: {
        key: entry.key,
        content: entry.content,
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString(),
      },
    };

    res.json(response);
  } catch (error) {
    console.error('[api] Error getting context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get context item',
      code: 'DATABASE_ERROR',
    });
  }
});

/**
 * PUT /api/context/:key
 * Create or update a context item
 * Body: { content: string }
 */
router.put('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authenticatedUserId!;
    const { key } = req.params;
    const { content } = req.body;

    // Validate key format
    const keyValidation = validateKey(key);
    if (!keyValidation.valid) {
      res.status(400).json({
        success: false,
        error: keyValidation.error,
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Validate content
    const contentValidation = validateContent(content);
    if (!contentValidation.valid) {
      res.status(400).json({
        success: false,
        error: contentValidation.error,
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Check if item exists to determine if create or update
    const existing = await getContext(userId, key);
    const entry = await setContext(userId, key, content);

    const response: ApiResponse<ContextResponse & { action: 'created' | 'updated' }> = {
      success: true,
      data: {
        key: entry.key,
        content: entry.content,
        created_at: entry.created_at.toISOString(),
        updated_at: entry.updated_at.toISOString(),
        action: existing ? 'updated' : 'created',
      },
    };

    res.status(existing ? 200 : 201).json(response);
  } catch (error) {
    console.error('[api] Error saving context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save context item',
      code: 'DATABASE_ERROR',
    });
  }
});

/**
 * DELETE /api/context/:key
 * Delete a context item
 */
router.delete('/:key', async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.authenticatedUserId!;
    const { key } = req.params;

    // Validate key format
    const keyValidation = validateKey(key);
    if (!keyValidation.valid) {
      res.status(400).json({
        success: false,
        error: keyValidation.error,
        code: 'INVALID_INPUT',
      });
      return;
    }

    const deleted = await deleteContext(userId, key);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: `Context item '${key}' not found`,
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        key,
        deleted: true,
      },
    });
  } catch (error) {
    console.error('[api] Error deleting context:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete context item',
      code: 'DATABASE_ERROR',
    });
  }
});

export default router;
