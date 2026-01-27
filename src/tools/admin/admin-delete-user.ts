/**
 * Admin tool: Delete a user
 */

import { z } from 'zod';
import { server } from '../../server.js';
import { deleteUser, getUserById, logAdminAction } from '../../db/queries.js';
import { validateUserId } from '../validators.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from '../errors.js';
import { requireAdmin } from './guards.js';

interface ToolHandlerExtra {
  sessionId?: string;
}

export const adminDeleteUserInputSchema = {
  user_id: z.string().describe('The user ID to delete'),
  confirm: z.boolean().describe('Must be true to confirm deletion. This action cannot be undone.'),
};

interface DeleteUserOutput {
  user_id: string;
  email: string;
  message: string;
}

/**
 * Register the admin_delete_user tool
 */
export function registerAdminDeleteUserTool(): void {
  server.registerTool(
    'admin_delete_user',
    {
      title: 'Delete User (Admin)',
      description: 'Permanently delete a user and all their data (API keys, context entries, history). This cannot be undone. Admin only.',
      inputSchema: adminDeleteUserInputSchema,
    },
    async ({ user_id, confirm }, extra: ToolHandlerExtra) => {
      // Check admin authorization
      const adminCheck = requireAdmin(extra.sessionId);
      if (!adminCheck.authorized) {
        return adminCheck.errorResponse;
      }

      // Require explicit confirmation
      if (confirm !== true) {
        return createToolResponse(
          formatError(new ToolError(
            ErrorCode.INVALID_INPUT,
            'Deletion requires confirm=true. This action permanently deletes all user data.'
          ))
        );
      }

      // Validate user_id
      const userIdValidation = validateUserId(user_id);
      if (!userIdValidation.valid) {
        return createToolResponse(
          formatError(new ToolError(ErrorCode.INVALID_INPUT, userIdValidation.error!))
        );
      }

      // Prevent admin from deleting themselves
      if (user_id === adminCheck.adminUserId) {
        return createToolResponse(
          formatError(new ToolError(ErrorCode.FORBIDDEN, 'Cannot delete your own admin account'))
        );
      }

      try {
        // Get user info before deletion for logging/response
        const user = await getUserById(user_id);
        if (!user) {
          return createToolResponse(
            formatError(new ToolError(ErrorCode.NOT_FOUND, `User '${user_id}' not found`))
          );
        }

        // Prevent deleting other admins (safety measure)
        if (user.is_admin) {
          return createToolResponse(
            formatError(new ToolError(ErrorCode.FORBIDDEN, 'Cannot delete admin users'))
          );
        }

        // Delete the user
        const deleted = await deleteUser(user_id);

        if (!deleted) {
          return createToolResponse(
            formatError(new ToolError(ErrorCode.NOT_FOUND, `User '${user_id}' not found`))
          );
        }

        // Log admin action
        await logAdminAction(adminCheck.adminUserId, 'delete_user', user_id, {
          email: user.email,
        });

        const data: DeleteUserOutput = {
          user_id,
          email: user.email,
          message: 'User and all associated data have been permanently deleted.',
        };

        return createToolResponse(formatSuccess(data));
      } catch (error) {
        console.error('[admin_delete_user] Database error:', error);
        return createToolResponse(
          formatError(new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to delete user'))
        );
      }
    }
  );
}
