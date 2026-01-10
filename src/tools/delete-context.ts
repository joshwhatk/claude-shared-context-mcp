import { z } from 'zod';
import { server } from '../server.js';
import { deleteContext } from '../db/queries.js';
import { validateKey } from './validators.js';
import { ToolError, ErrorCode, formatSuccess, formatError, createToolResponse } from './errors.js';

// Input schema for delete_context tool
export const deleteContextInputSchema = {
  key: z.string().describe('The unique key identifying the context entry to delete'),
};

// Output type
interface DeleteContextOutput {
  key: string;
  deleted: boolean;
}

/**
 * Register the delete_context tool
 */
export function registerDeleteContextTool(): void {
  server.registerTool(
    'delete_context',
    {
      title: 'Delete Context',
      description: 'Delete a context entry by its key',
      inputSchema: deleteContextInputSchema,
    },
    async ({ key }) => {
      // Validate key
      const keyValidation = validateKey(key);
      if (!keyValidation.valid) {
        const response = formatError(new ToolError(ErrorCode.INVALID_INPUT, keyValidation.error!));
        return createToolResponse(response);
      }

      try {
        // Attempt deletion
        const deleted = await deleteContext(key);

        if (!deleted) {
          const response = formatError(
            new ToolError(ErrorCode.NOT_FOUND, `Context entry '${key}' not found`)
          );
          return createToolResponse(response);
        }

        const data: DeleteContextOutput = {
          key,
          deleted: true,
        };

        const response = formatSuccess(data, new Date());
        return createToolResponse(response);
      } catch (error) {
        console.error('[delete_context] Database error:', error);
        const response = formatError(
          new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to delete context entry')
        );
        return createToolResponse(response);
      }
    }
  );
}
