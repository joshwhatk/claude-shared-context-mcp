import { z } from 'zod';
import { server } from '../server.js';
import { getContext } from '../db/queries.js';
import { getUserIdFromSession } from '../auth/session-context.js';
import { validateKey } from './validators.js';
import { ToolError, ErrorCode, formatSuccess, formatError, createToolResponse } from './errors.js';

// Minimal type for the extra parameter passed to tool handlers
interface ToolHandlerExtra {
  sessionId?: string;
}

// Input schema for read_context tool
export const readContextInputSchema = {
  key: z.string().describe('The unique key identifying the context entry to read'),
};

// Output type
interface ReadContextOutput {
  key: string;
  content: string;
  created_at: string;
  updated_at: string;
}

/**
 * Register the read_context tool
 */
export function registerReadContextTool(): void {
  server.registerTool(
    'read_context',
    {
      title: 'Read Context',
      description: 'Read a single context entry by its key',
      inputSchema: readContextInputSchema,
    },
    async ({ key }, extra: ToolHandlerExtra) => {
      // Get user ID from session context
      const userId = getUserIdFromSession(extra.sessionId);
      if (!userId) {
        const response = formatError(
          new ToolError(ErrorCode.UNAUTHORIZED, 'Not authenticated')
        );
        return createToolResponse(response);
      }

      // Validate key
      const keyValidation = validateKey(key);
      if (!keyValidation.valid) {
        const response = formatError(new ToolError(ErrorCode.INVALID_INPUT, keyValidation.error!));
        return createToolResponse(response);
      }

      try {
        // Fetch from database (filtered by user)
        const entry = await getContext(userId, key);

        if (!entry) {
          const response = formatError(
            new ToolError(ErrorCode.NOT_FOUND, `Context entry '${key}' not found`)
          );
          return createToolResponse(response);
        }

        const data: ReadContextOutput = {
          key: entry.key,
          content: entry.content,
          created_at: entry.created_at.toISOString(),
          updated_at: entry.updated_at.toISOString(),
        };

        const response = formatSuccess(data);
        return createToolResponse(response);
      } catch (error) {
        console.error('[read_context] Database error:', error);
        const response = formatError(
          new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to read context entry')
        );
        return createToolResponse(response);
      }
    }
  );
}
