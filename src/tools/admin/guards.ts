/**
 * Admin authorization guards for MCP tools
 */

import { resolveUserId, resolveIsAdmin, ToolHandlerExtra } from '../../auth/identity.js';
import { ToolError, ErrorCode, formatError, createToolResponse } from '../errors.js';

export interface AdminAuthResult {
  authorized: true;
  adminUserId: string;
}

export interface AdminAuthError {
  authorized: false;
  errorResponse: ReturnType<typeof createToolResponse>;
}

export type AdminCheck = AdminAuthResult | AdminAuthError;

/**
 * Check if the current session belongs to an admin user
 * Returns either the admin user ID or a formatted error response
 */
export async function requireAdmin(extra: ToolHandlerExtra): Promise<AdminCheck> {
  // First check if user is authenticated
  const userId = await resolveUserId(extra);
  if (!userId) {
    return {
      authorized: false,
      errorResponse: createToolResponse(
        formatError(new ToolError(ErrorCode.UNAUTHORIZED, 'Not authenticated'))
      ),
    };
  }

  // Then check if user is admin
  const isAdmin = await resolveIsAdmin(extra);
  if (!isAdmin) {
    return {
      authorized: false,
      errorResponse: createToolResponse(
        formatError(new ToolError(ErrorCode.FORBIDDEN, 'Admin access required'))
      ),
    };
  }

  return {
    authorized: true,
    adminUserId: userId,
  };
}
