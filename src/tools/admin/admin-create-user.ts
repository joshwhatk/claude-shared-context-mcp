/**
 * Admin tool: Create a new user
 */

import { z } from 'zod';
import { server } from '../../server.js';
import { createUser, createApiKey, getUserById, logAdminAction } from '../../db/queries.js';
import { validateUserId, validateEmail, validateApiKeyName } from '../validators.js';
import { formatSuccess, formatError, createToolResponse, ToolError, ErrorCode } from '../errors.js';
import { requireAdmin } from './guards.js';

interface ToolHandlerExtra {
  sessionId?: string;
}

export const adminCreateUserInputSchema = {
  user_id: z.string().describe('Unique user ID (alphanumeric with dashes/underscores, max 50 chars)'),
  email: z.string().describe('User email address'),
  api_key_name: z.string().optional().describe('Name for the initial API key (default: "default")'),
};

interface CreateUserOutput {
  user_id: string;
  email: string;
  api_key: string;
  api_key_name: string;
  message: string;
}

/**
 * Register the admin_create_user tool
 */
export function registerAdminCreateUserTool(): void {
  server.registerTool(
    'admin_create_user',
    {
      title: 'Create User (Admin)',
      description: 'Create a new user and generate their initial API key. The API key is shown only once. Admin only.',
      inputSchema: adminCreateUserInputSchema,
    },
    async ({ user_id, email, api_key_name }, extra: ToolHandlerExtra) => {
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

      // Validate email
      const emailValidation = validateEmail(email);
      if (!emailValidation.valid) {
        return createToolResponse(
          formatError(new ToolError(ErrorCode.INVALID_INPUT, emailValidation.error!))
        );
      }

      // Validate API key name if provided
      const keyName = api_key_name ?? 'default';
      const keyNameValidation = validateApiKeyName(keyName);
      if (!keyNameValidation.valid) {
        return createToolResponse(
          formatError(new ToolError(ErrorCode.INVALID_INPUT, keyNameValidation.error!))
        );
      }

      try {
        // Check if user already exists
        const existingUser = await getUserById(user_id);
        if (existingUser) {
          return createToolResponse(
            formatError(new ToolError(ErrorCode.INVALID_INPUT, `User '${user_id}' already exists`))
          );
        }

        // Create the user
        await createUser(user_id, email, 'manual');

        // Create initial API key
        const { plainKey } = await createApiKey(user_id, keyName);

        // Log admin action
        await logAdminAction(adminCheck.adminUserId, 'create_user', user_id, {
          email,
          api_key_name: keyName,
        });

        const data: CreateUserOutput = {
          user_id,
          email,
          api_key: plainKey,
          api_key_name: keyName,
          message: 'User created successfully. Save the API key - it will not be shown again.',
        };

        return createToolResponse(formatSuccess(data));
      } catch (error) {
        console.error('[admin_create_user] Database error:', error);

        // Check for unique constraint violation on email
        const errorMessage = error instanceof Error ? error.message : String(error);
        if (errorMessage.includes('duplicate key') || errorMessage.includes('unique constraint')) {
          return createToolResponse(
            formatError(new ToolError(ErrorCode.INVALID_INPUT, 'A user with this email already exists'))
          );
        }

        return createToolResponse(
          formatError(new ToolError(ErrorCode.DATABASE_ERROR, 'Failed to create user'))
        );
      }
    }
  );
}
