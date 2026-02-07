/**
 * Unified Identity Resolver
 *
 * Extracts user identity from MCP tool handler's extra parameter.
 * Supports two auth paths:
 * 1. Clerk OAuth: authInfo.extra.userId → database user lookup
 * 2. API key sessions: sessionId → session context store lookup
 */

import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { getUserByClerkId, getUserById, User } from '../db/queries.js';
import { getUserIdFromSession, isSessionAdmin } from './session-context.js';

/**
 * The extra parameter passed to MCP tool handlers.
 * Contains authInfo from Clerk OAuth or sessionId from API key auth.
 */
export interface ToolHandlerExtra {
  authInfo?: AuthInfo;
  sessionId?: string;
}

/**
 * Resolve the full database user from the tool handler's extra parameter.
 * Returns the complete User object, enabling callers to read both id and
 * is_admin without issuing separate DB queries.
 *
 * @returns The database User, or null if not authenticated
 */
export async function resolveUser(extra: ToolHandlerExtra): Promise<User | null> {
  // Clerk OAuth path: authInfo.extra contains Clerk user ID
  const clerkUserId = extra.authInfo?.extra?.userId;
  if (typeof clerkUserId === 'string') {
    return getUserByClerkId(clerkUserId);
  }

  // API key session path: sessionId → session context store → DB user
  const sessionUserId = getUserIdFromSession(extra.sessionId);
  if (!sessionUserId) return null;
  return getUserById(sessionUserId);
}

/**
 * Resolve the internal user ID from the tool handler's extra parameter.
 * Uses in-memory session store for API key path (no DB query).
 *
 * @returns The internal user ID, or null if not authenticated
 */
export async function resolveUserId(extra: ToolHandlerExtra): Promise<string | null> {
  // Clerk OAuth path
  const clerkUserId = extra.authInfo?.extra?.userId;
  if (typeof clerkUserId === 'string') {
    const user = await getUserByClerkId(clerkUserId);
    return user?.id ?? null;
  }

  // API key session path (in-memory, no DB query)
  return getUserIdFromSession(extra.sessionId);
}

/**
 * Resolve whether the current user is an admin.
 * Uses in-memory session store for API key path (no DB query).
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

  // API key session path (in-memory, no DB query)
  return isSessionAdmin(extra.sessionId);
}
