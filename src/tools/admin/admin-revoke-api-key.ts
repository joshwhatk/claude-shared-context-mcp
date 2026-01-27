/**
 * Admin tool: Revoke an API key
 */

import { z } from 'zod';
import { server } from '../../server.js';
import { revokeApiKeyByName, userExists, listApiKeysForUser, logAdminAction } from '../../db/queries.js';
import { validateUserId, validateApiKeyName } from '../validators.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from '../errors.js';
import { requireAdmin } from './guards.js';

interface ToolHandlerExtra {
  sessionId?: string;
}

export const adminRevokeApiKeyInputSchema = {
  user_id: z.string().describe('The user ID whose API key should be revoked'),
  api_key_name: z.string().describe('The name of the API key to revoke'),
};

interface RevokeApiKeyOutput {
  user_id: string;
  api_key_name: string;
  message: string;
}

/**
 * Register the admin_revoke_api_key tool
 */
export function registerAdminRevokeApiKeyTool(): void {
  server.registerTool(
    'admin_revoke_api_key',
    {
      title: 'Revoke API Key (Admin)',
      description: 'Revoke/delete an API key by name for a user. The key will immediately stop working. Admin only.',
      inputSchema: adminRevokeApiKeyInputSchema,
    },
    async ({ user_id, api_key_name }, extra: ToolHandlerExtra) => {
      // Check admin authorization
      const adminCheck = requireAdmin(extra.sessionId);
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
      const keyNameValidation = validateApiKeyName(api_key_name);
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

        // Attempt to revoke the key
        const revoked = await revokeApiKeyByName(user_id, api_key_name);

        if (!revoked) {
          // Key not found - list available keys to help admin
          const keys = await listApiKeysForUser(user_id);
          const keyNames = keys.map(k => k.name).join(', ') || 'none';
          return createToolResponse(
            formatError(new ToolError(
              ErrorCode.NOT_FOUND,
              `API key '${api_key_name}' not found for user '${user_id}'. Available keys: ${keyNames}`
            ))
          );
        }

        // Log admin action
        await logAdminAction(adminCheck.adminUserId, 'revoke_api_key', user_id, {
          api_key_name,
        });

        const data: RevokeApiKeyOutput = {
          user_id,
          api_key_name,
          message: 'API key revoked successfully. It will no longer work for authentication.',
        };

        return createToolResponse(formatSuccess(data));
      } catch (error) {
        console.error('[admin_revoke_api_key] Database error:', error);
        return createToolResponse(
          formatError(new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to revoke API key'))
        );
      }
    }
  );
}
