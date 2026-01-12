import { z } from 'zod';
import { server } from '../server.js';
import { listContextKeys } from '../db/queries.js';
import { getUserIdFromSession } from '../auth/session-context.js';
import { validateLimit } from './validators.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from './errors.js';

// Minimal type for the extra parameter passed to tool handlers
interface ToolHandlerExtra {
  sessionId?: string;
}

// Constants for list limits
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

// Input schema for list_context tool
export const listContextInputSchema = {
  limit: z.number().optional().describe(`Maximum number of entries to return (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})`),
  search: z.string().optional().describe('Optional search pattern to filter keys (case-insensitive)'),
};

// Output type
interface ListContextOutput {
  entries: Array<{
    key: string;
    updated_at: string;
  }>;
  count: number;
  limit: number;
  search?: string;
}

/**
 * Register the list_context tool
 */
export function registerListContextTool(): void {
  server.registerTool(
    'list_context',
    {
      title: 'List Context',
      description: 'List all context keys with metadata, optionally filtered by search pattern',
      inputSchema: listContextInputSchema,
    },
    async ({ limit, search }, extra: ToolHandlerExtra) => {
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

        // Fetch keys from database (filtered by user)
        const entries = await listContextKeys(userId, safeLimit, search);

        const data: ListContextOutput = {
          entries: entries.map((entry) => ({
            key: entry.key,
            updated_at: entry.updated_at.toISOString(),
          })),
          count: entries.length,
          limit: safeLimit,
          ...(search && { search }),
        };

        const response = formatSuccess(data);
        return createToolResponse(response);
      } catch (error) {
        console.error('[list_context] Database error:', error);
        const response = formatError(
          new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to list context entries')
        );
        return createToolResponse(response);
      }
    }
  );
}
