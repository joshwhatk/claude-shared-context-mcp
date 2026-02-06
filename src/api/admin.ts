/**
 * Admin REST API router for user management
 * All endpoints require admin privileges (req.isAdmin === true)
 */

import { Router, Request, Response } from 'express';
import {
  listAllUsers,
  deleteUser,
  logAdminAction,
} from '../db/queries.js';

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
 * List all users with context entry counts
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

export default router;
