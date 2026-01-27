/**
 * Session Context Store
 *
 * Maps MCP session IDs to authenticated user IDs.
 * This bridges the gap between HTTP authentication middleware
 * and MCP tool handlers, which only receive session IDs.
 */

export interface SessionContext {
  userId: string;
  apiKeyHash: string;
  authenticatedAt: Date;
  isAdmin: boolean;
}

// In-memory store (sessions are ephemeral)
const sessionContextMap = new Map<string, SessionContext>();

/**
 * Associate a session with a user context
 */
export function setSessionContext(sessionId: string, context: SessionContext): void {
  sessionContextMap.set(sessionId, context);
  console.log('[session] Context set for session:', sessionId.substring(0, 8) + '...');
}

/**
 * Get the full session context
 */
export function getSessionContext(sessionId: string): SessionContext | null {
  return sessionContextMap.get(sessionId) ?? null;
}

/**
 * Get just the user ID from a session
 * This is the main function used by tool handlers
 */
export function getUserIdFromSession(sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  return sessionContextMap.get(sessionId)?.userId ?? null;
}

/**
 * Remove session context (called when session closes)
 */
export function clearSessionContext(sessionId: string): void {
  if (sessionContextMap.has(sessionId)) {
    sessionContextMap.delete(sessionId);
    console.log('[session] Context cleared for session:', sessionId.substring(0, 8) + '...');
  }
}

/**
 * Clear all session contexts (for graceful shutdown)
 */
export function clearAllSessionContexts(): void {
  const count = sessionContextMap.size;
  sessionContextMap.clear();
  if (count > 0) {
    console.log(`[session] Cleared ${count} session contexts`);
  }
}

/**
 * Get count of active sessions (for monitoring)
 */
export function getActiveSessionCount(): number {
  return sessionContextMap.size;
}

/**
 * Check if a session belongs to an admin user
 * @returns true if the session exists and user is admin, false otherwise
 */
export function isSessionAdmin(sessionId: string | undefined): boolean {
  if (!sessionId) return false;
  return sessionContextMap.get(sessionId)?.isAdmin ?? false;
}
