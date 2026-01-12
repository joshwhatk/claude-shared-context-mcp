import { z } from 'zod';
import { server } from '../server.js';
import { getAllContext } from '../db/queries.js';
import { getUserIdFromSession } from '../auth/session-context.js';
import { validateLimit } from './validators.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from './errors.js';

// Minimal type for the extra parameter passed to tool handlers
interface ToolHandlerExtra {
  sessionId?: string;
}

// Constants for read_all limits (lower than list since we return content)
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

// Input schema for read_all_context tool
export const readAllContextInputSchema = {
  limit: z.number().optional().describe(`Maximum number of entries to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`),
};

// Output type
interface ReadAllContextOutput {
  entries: Array<{
    key: string;
    content: string;
    created_at: string;
    updated_at: string;
  }>;
  count: number;
  limit: number;
}

/**
 * Register the read_all_context tool
 */
export function registerReadAllContextTool(): void {
  server.registerTool(
    'read_all_context',
    {
      title: 'Read All Context',
      description: 'Read all context entries with their content, ordered by most recently updated',
      inputSchema: readAllContextInputSchema,
    },
    async ({ limit }, extra: ToolHandlerExtra) => {
      // Get user ID from session context
      const userId = getUserIdFromSession(extra.sessionId);
      if (!userId) {
        const response = formatError(
          new ToolError(ErrorCode.UNAUTHORIZED, 'Not authenticated')
        );
        return createToolResponse(response);
      }

      try {
        // Validate and normalize limit
        const safeLimit = validateLimit(limit ?? DEFAULT_LIMIT, MAX_LIMIT, DEFAULT_LIMIT);

        // Fetch all entries from database (filtered by user)
        const entries = await getAllContext(userId, safeLimit);

        const data: ReadAllContextOutput = {
          entries: entries.map((entry) => ({
            key: entry.key,
            content: entry.content,
            created_at: entry.created_at.toISOString(),
            updated_at: entry.updated_at.toISOString(),
          })),
          count: entries.length,
          limit: safeLimit,
        };

        const response = formatSuccess(data);
        return createToolResponse(response);
      } catch (error) {
        console.error('[read_all_context] Database error:', error);
        const response = formatError(
          new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to read context entries')
        );
        return createToolResponse(response);
      }
    }
  );
}
