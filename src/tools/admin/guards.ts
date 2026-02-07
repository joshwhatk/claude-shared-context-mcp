/**
 * Admin authorization guards for MCP tools
 */

import { resolveUser, ToolHandlerExtra } from '../../auth/identity.js';
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
 * Check if the current session belongs to an admin user.
 * Uses resolveUser() to perform a single DB query instead of
 * separate resolveUserId + resolveIsAdmin calls.
 */
export async function requireAdmin(extra: ToolHandlerExtra): Promise<AdminCheck> {
  const user = await resolveUser(extra);

  if (!user) {
    return {
      authorized: false,
      errorResponse: createToolResponse(
        formatError(new ToolError(ErrorCode.UNAUTHORIZED, 'Not authenticated'))
      ),
    };
  }

  if (!user.is_admin) {
    return {
      authorized: false,
      errorResponse: createToolResponse(
        formatError(new ToolError(ErrorCode.FORBIDDEN, 'Admin access required'))
      ),
    };
  }

  return {
    authorized: true,
    adminUserId: user.id,
  };
}
