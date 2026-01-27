/**
 * Admin authorization guards for MCP tools
 */

import { isSessionAdmin, getUserIdFromSession } from '../../auth/session-context.js';
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
export function requireAdmin(sessionId: string | undefined): AdminCheck {
  // First check if user is authenticated
  const userId = getUserIdFromSession(sessionId);
  if (!userId) {
    return {
      authorized: false,
      errorResponse: createToolResponse(
        formatError(new ToolError(ErrorCode.UNAUTHORIZED, 'Not authenticated'))
      ),
    };
  }

  // Then check if user is admin
  if (!isSessionAdmin(sessionId)) {
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
