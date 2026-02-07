/**
 * Self-service API key management REST endpoints
 * All endpoints scoped to the authenticated user (no admin required)
 */

import { Router, Request, Response } from 'express';
import { listApiKeysForUser, createApiKey, revokeApiKeyByName } from '../db/queries.js';

const router = Router();

/**
 * GET /api/keys
 * List own API keys
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const keys = await listApiKeysForUser(req.authenticatedUserId!);

    res.json({
      success: true,
      data: {
        keys,
        count: keys.length,
      },
    });
  } catch (error) {
    console.error('[keys] List keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/keys
 * Create a new API key for the authenticated user
 * Body: { name: string }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name } = req.body;

    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'name is required and must be a string',
        code: 'INVALID_INPUT',
      });
      return;
    }

    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
      res.status(400).json({
        success: false,
        error: 'name must be between 1 and 100 characters',
        code: 'INVALID_INPUT',
      });
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
      res.status(400).json({
        success: false,
        error: 'name must contain only alphanumeric characters, dashes, and underscores',
        code: 'INVALID_INPUT',
      });
      return;
    }

    const { plainKey } = await createApiKey(req.authenticatedUserId!, trimmed);

    res.status(201).json({
      success: true,
      data: {
        apiKey: plainKey,
        keyName: trimmed,
      },
    });
  } catch (error) {
    console.error('[keys] Create key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/keys/:keyName
 * Revoke an API key by name for the authenticated user
 */
router.delete('/:keyName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { keyName } = req.params;

    const revoked = await revokeApiKeyByName(req.authenticatedUserId!, keyName);

    if (!revoked) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    res.json({
      success: true,
      data: {
        keyName,
        revoked: true,
      },
    });
  } catch (error) {
    console.error('[keys] Revoke key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
