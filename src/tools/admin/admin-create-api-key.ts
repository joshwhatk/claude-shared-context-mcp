/**
 * Admin tool: Create an API key for an existing user
 */

import { z } from 'zod';
import { server } from '../../server.js';
import { createApiKey, userExists, logAdminAction } from '../../db/queries.js';
import { validateUserId, validateApiKeyName } from '../validators.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from '../errors.js';
import { requireAdmin } from './guards.js';
import type { ToolHandlerExtra } from '../../auth/identity.js';

export const adminCreateApiKeyInputSchema = {
  user_id: z.string().describe('The user ID to create an API key for'),
  name: z.string().describe('A name/label for this API key (e.g., "laptop", "work-machine")'),
};

interface CreateApiKeyOutput {
  user_id: string;
  api_key: string;
  api_key_name: string;
  message: string;
}

/**
 * Register the admin_create_api_key tool
 */
export function registerAdminCreateApiKeyTool(): void {
  server.registerTool(
    'admin_create_api_key',
    {
      title: 'Create API Key (Admin)',
      description: 'Create a new API key for an existing user. The API key is shown only once. Admin only.',
      inputSchema: adminCreateApiKeyInputSchema,
    },
    async ({ user_id, name }, extra: ToolHandlerExtra) => {
      // Check admin authorization
      const adminCheck = await requireAdmin(extra);
      if (!adminCheck.authorized) {
        return adminCheck.errorResponse;
      }

      // Validate user_id
      const userIdValidation = validateUserId(user_id);
      if (!userIdValidation.valid) {
        return createToolResponse(
          formatError(new ToolError(ErrorCode.INVALID_INPUT, userIdValidation.error!))
        );
      }

      // Validate API key name
      const keyNameValidation = validateApiKeyName(name);
      if (!keyNameValidation.valid) {
        return createToolResponse(
          formatError(new ToolError(ErrorCode.INVALID_INPUT, keyNameValidation.error!))
        );
      }

      try {
        // Check if user exists
        const exists = await userExists(user_id);
        if (!exists) {
          return createToolResponse(
            formatError(new ToolError(ErrorCode.NOT_FOUND, `User '${user_id}' not found`))
          );
        }

        // Create API key
        const { plainKey } = await createApiKey(user_id, name);

        // Log admin action
        await logAdminAction(adminCheck.adminUserId, 'create_api_key', user_id, {
          api_key_name: name,
        });

        const data: CreateApiKeyOutput = {
          user_id,
          api_key: plainKey,
          api_key_name: name,
          message: 'API key created successfully. Save it - it will not be shown again.',
        };

        return createToolResponse(formatSuccess(data));
      } catch (error) {
        console.error('[admin_create_api_key] Database error:', error);
        return createToolResponse(
          formatError(new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to create API key'))
        );
      }
    }
  );
}
