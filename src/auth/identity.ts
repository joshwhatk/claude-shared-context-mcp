/**
 * Unified Identity Resolver
 *
 * Extracts user identity from MCP tool handler's extra parameter.
 * Supports both Clerk OAuth (via authInfo) and legacy API key (via sessionId) paths.
 * The legacy path will be removed once API key auth is fully deprecated.
 */

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getUserByClerkId } from '../db/queries.js';
import { getUserIdFromSession, isSessionAdmin } from './session-context.js';

/**
 * The extra parameter passed to MCP tool handlers.
 * Contains either authInfo (Clerk OAuth path) or sessionId (legacy API key path).
 */
export interface ToolHandlerExtra {
  authInfo?: AuthInfo;
  sessionId?: string;
}

/**
 * Resolve the internal user ID from the tool handler's extra parameter.
 * Tries Clerk OAuth first, then falls back to legacy session-based auth.
 *
 * @returns The internal user ID, or null if not authenticated
 */
export async function resolveUserId(extra: ToolHandlerExtra): Promise<string | null> {
  // Clerk OAuth path: authInfo.extra contains Clerk user ID
  const clerkUserId = extra.authInfo?.extra?.userId;
  if (typeof clerkUserId === 'string') {
    const user = await getUserByClerkId(clerkUserId);
    return user?.id ?? null;
  }

  // Legacy API key path (via session context store)
  if (extra.sessionId) {
    return getUserIdFromSession(extra.sessionId);
  }

  return null;
}

/**
 * Resolve whether the current user is an admin.
 *
 * @returns true if the user is an admin, false otherwise
 */
export async function resolveIsAdmin(extra: ToolHandlerExtra): Promise<boolean> {
  // Clerk OAuth path
  const clerkUserId = extra.authInfo?.extra?.userId;
  if (typeof clerkUserId === 'string') {
    const user = await getUserByClerkId(clerkUserId);
    return user?.is_admin ?? false;
  }

  // Legacy API key path
  if (extra.sessionId) {
    return isSessionAdmin(extra.sessionId);
  }

  return false;
}
