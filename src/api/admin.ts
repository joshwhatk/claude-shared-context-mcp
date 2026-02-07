/**
 * Admin REST API router for user and API key management
 * All endpoints require admin privileges (req.isAdmin === true)
 */

import { Router, Request, Response } from 'express';
import {
  listAllUsers,
  createUserWithApiKey,
  deleteUser,
  listApiKeysForUser,
  createApiKey,
  revokeApiKeyByName,
  userExists,
  logAdminAction,
  countUserApiKeys,
} from '../db/queries.js';

const MAX_API_KEYS_PER_USER = 10;

const router = Router();

/**
 * Admin authorization middleware
 * Returns 403 if user is not an admin
 */
function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (!req.isAdmin) {
    res.status(403).json({
      success: false,
      error: 'Admin access required',
      code: 'FORBIDDEN',
    });
    return;
  }
  next();
}

// Apply admin check to all routes
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * List all users with API key and context entry counts
 */
router.get('/users', async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await listAllUsers();

    res.json({
      success: true,
      data: {
        users,
        count: users.length,
      },
    });
  } catch (error) {
    console.error('[admin] List users error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list users',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/admin/users
 * Create a new user with an initial API key
 * Body: { userId: string, email: string, keyName?: string }
 * Returns the new user and the plain API key (shown once only!)
 */
router.post('/users', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, email, keyName = 'default' } = req.body;

    // Validate required fields
    if (!userId || typeof userId !== 'string') {
      res.status(400).json({
        success: false,
        error: 'userId is required and must be a string',
        code: 'INVALID_INPUT',
      });
      return;
    }

    if (!email || typeof email !== 'string') {
      res.status(400).json({
        success: false,
        error: 'email is required and must be a string',
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Validate userId format (alphanumeric, dash, underscore)
    if (!/^[a-zA-Z0-9_-]+$/.test(userId)) {
      res.status(400).json({
        success: false,
        error: 'userId must contain only alphanumeric characters, dashes, and underscores',
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Create user with API key in a single transaction
    const { user, plainKey } = await createUserWithApiKey(userId, email, keyName, 'manual');

    // Log admin action
    await logAdminAction(
      req.authenticatedUserId!,
      'create_user',
      userId,
      { email, keyName }
    );

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          is_admin: user.is_admin,
          created_at: user.created_at,
        },
        apiKey: plainKey,
        keyName,
      },
    });
  } catch (error) {
    // Handle duplicate user ID (unique constraint violation)
    const pgError = error as { code?: string; constraint?: string };
    if (pgError.code === '23505') {
      res.status(409).json({
        success: false,
        error: 'User with this ID or email already exists',
        code: 'CONFLICT',
      });
      return;
    }

    console.error('[admin] Create user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create user',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/admin/users/:userId
 * Delete a user and all their data
 */
router.delete('/users/:userId', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Prevent self-deletion
    if (userId === req.authenticatedUserId) {
      res.status(400).json({
        success: false,
        error: 'Cannot delete your own account',
        code: 'INVALID_OPERATION',
      });
      return;
    }

    const deleted = await deleteUser(userId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Log admin action
    await logAdminAction(
      req.authenticatedUserId!,
      'delete_user',
      userId,
      null
    );

    res.json({
      success: true,
      data: {
        userId,
        deleted: true,
      },
    });
  } catch (error) {
    console.error('[admin] Delete user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete user',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * GET /api/admin/users/:userId/keys
 * List all API keys for a user
 */
router.get('/users/:userId/keys', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;

    // Check if user exists
    if (!(await userExists(userId))) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    const keys = await listApiKeysForUser(userId);

    res.json({
      success: true,
      data: {
        userId,
        keys,
        count: keys.length,
      },
    });
  } catch (error) {
    console.error('[admin] List keys error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to list API keys',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * POST /api/admin/users/:userId/keys
 * Create a new API key for a user
 * Body: { name: string }
 */
router.post('/users/:userId/keys', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const { name } = req.body;

    // Validate required fields
    if (!name || typeof name !== 'string') {
      res.status(400).json({
        success: false,
        error: 'name is required and must be a string',
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Check if user exists
    if (!(await userExists(userId))) {
      res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Enforce API key count limit
    const keyCount = await countUserApiKeys(userId);
    if (keyCount >= MAX_API_KEYS_PER_USER) {
      res.status(400).json({
        success: false,
        error: `Maximum of ${MAX_API_KEYS_PER_USER} API keys per user reached`,
        code: 'LIMIT_EXCEEDED',
      });
      return;
    }

    // Create API key
    const { plainKey } = await createApiKey(userId, name);

    // Log admin action
    await logAdminAction(
      req.authenticatedUserId!,
      'create_api_key',
      userId,
      { keyName: name }
    );

    res.status(201).json({
      success: true,
      data: {
        userId,
        apiKey: plainKey,
        keyName: name,
      },
    });
  } catch (error) {
    console.error('[admin] Create key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create API key',
      code: 'INTERNAL_ERROR',
    });
  }
});

/**
 * DELETE /api/admin/users/:userId/keys/:keyName
 * Revoke an API key
 */
router.delete('/users/:userId/keys/:keyName', async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId, keyName } = req.params;

    const revoked = await revokeApiKeyByName(userId, keyName);

    if (!revoked) {
      res.status(404).json({
        success: false,
        error: 'API key not found',
        code: 'NOT_FOUND',
      });
      return;
    }

    // Log admin action
    await logAdminAction(
      req.authenticatedUserId!,
      'revoke_api_key',
      userId,
      { keyName }
    );

    res.json({
      success: true,
      data: {
        userId,
        keyName,
        revoked: true,
      },
    });
  } catch (error) {
    console.error('[admin] Revoke key error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to revoke API key',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
