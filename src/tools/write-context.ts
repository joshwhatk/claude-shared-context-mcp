import { z } from 'zod';
import { server } from '../server.js';
import { setContext, getContext } from '../db/queries.js';
import { getUserIdFromSession } from '../auth/session-context.js';
import { validateKey, validateContent } from './validators.js';
import { ToolError, ErrorCode, formatSuccess, formatError, createToolResponse } from './errors.js';

// Minimal type for the extra parameter passed to tool handlers
interface ToolHandlerExtra {
  sessionId?: string;
}

// Input schema for write_context tool
export const writeContextInputSchema = {
  key: z.string().describe('The unique key for the context entry (alphanumeric, dash, underscore, dot)'),
  content: z.string().describe('The content to store (max 100KB)'),
};

// Output type
interface WriteContextOutput {
  key: string;
  created_at: string;
  updated_at: string;
  action: 'created' | 'updated';
}

/**
 * Register the write_context tool
 */
export function registerWriteContextTool(): void {
  server.registerTool(
    'write_context',
    {
      title: 'Write Context',
      description: 'Create or update a context entry. If the key exists, it will be updated.',
      inputSchema: writeContextInputSchema,
    },
    async ({ key, content }, extra: ToolHandlerExtra) => {
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

      // Validate content
      const contentValidation = validateContent(content);
      if (!contentValidation.valid) {
        const response = formatError(new ToolError(ErrorCode.INVALID_INPUT, contentValidation.error!));
        return createToolResponse(response);
      }

      try {
        // Get existing entry to determine action type (filtered by user)
        const existing = await getContext(userId, key);
        const action = existing ? 'updated' : 'created';

        // Perform upsert (with user isolation)
        const entry = await setContext(userId, key, content);

        const data: WriteContextOutput = {
          key: entry.key,
          created_at: entry.created_at.toISOString(),
          updated_at: entry.updated_at.toISOString(),
          action,
        };

        const response = formatSuccess(data, entry.updated_at);
        return createToolResponse(response);
      } catch (error) {
        console.error('[write_context] Database error:', error);
        const response = formatError(
          new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to write context entry')
        );
        return createToolResponse(response);
      }
    }
  );
}
