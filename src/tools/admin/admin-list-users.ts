/**
 * Admin tool: List all users
 */

import { server } from '../../server.js';
import { listAllUsers, logAdminAction } from '../../db/queries.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from '../errors.js';
import { requireAdmin } from './guards.js';
import type { ToolHandlerExtra } from '../../auth/identity.js';

interface UserListItem {
  id: string;
  email: string;
  auth_provider: string;
  is_admin: boolean;
  created_at: string;
  updated_at: string;
  api_key_count: number;
  context_entry_count: number;
}

interface ListUsersOutput {
  users: UserListItem[];
  count: number;
}

/**
 * Register the admin_list_users tool
 */
export function registerAdminListUsersTool(): void {
  server.registerTool(
    'admin_list_users',
    {
      title: 'List Users (Admin)',
      description: 'List all users with their metadata, API key counts, and context entry counts. Admin only.',
      inputSchema: {},
    },
    async (_args, extra: ToolHandlerExtra) => {
      // Check admin authorization
      const adminCheck = await requireAdmin(extra);
      if (!adminCheck.authorized) {
        return adminCheck.errorResponse;
      }

      try {
        const users = await listAllUsers();

        // Log admin action (fire-and-forget)
        logAdminAction(adminCheck.adminUserId, 'list_users', null, { user_count: users.length })
          .catch(err => console.error('[admin_list_users] Failed to log action:', err));

        const data: ListUsersOutput = {
          users: users.map(u => ({
            id: u.id,
            email: u.email,
            auth_provider: u.auth_provider,
            is_admin: u.is_admin,
            created_at: u.created_at.toISOString(),
            updated_at: u.updated_at.toISOString(),
            api_key_count: u.api_key_count,
            context_entry_count: u.context_entry_count,
          })),
          count: users.length,
        };

        return createToolResponse(formatSuccess(data));
      } catch (error) {
        console.error('[admin_list_users] Database error:', error);
        return createToolResponse(
          formatError(new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to list users'))
        );
      }
    }
  );
}
