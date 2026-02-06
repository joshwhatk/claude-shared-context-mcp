/**
 * Unified Identity Resolver
 *
 * Extracts user identity from MCP tool handler's extra parameter using Clerk OAuth.
 * The Clerk MCP middleware attaches authInfo to the tool handler's extra parameter,
 * which contains the Clerk user ID in authInfo.extra.userId.
 */

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getUserByClerkId } from '../db/queries.js';

/**
 * The extra parameter passed to MCP tool handlers.
 * Contains authInfo from Clerk OAuth.
 */
export interface ToolHandlerExtra {
  authInfo?: AuthInfo;
  sessionId?: string;
}

/**
 * Resolve the internal user ID from the tool handler's extra parameter.
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

  return null;
}

/**
 * Resolve whether the current user is an admin.
 *
 * @returns true if the user is an admin, false otherwise
 */
export async function resolveIsAdmin(extra: ToolHandlerExtra): Promise<boolean> {
  const clerkUserId = extra.authInfo?.extra?.userId;
  if (typeof clerkUserId === 'string') {
    const user = await getUserByClerkId(clerkUserId);
    return user?.is_admin ?? false;
  }

  return false;
}
