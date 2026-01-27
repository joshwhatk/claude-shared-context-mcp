/**
 * Admin tools barrel file
 * Exports registration functions for all admin MCP tools
 */

import { registerAdminListUsersTool } from './admin-list-users.js';
import { registerAdminCreateUserTool } from './admin-create-user.js';
import { registerAdminCreateApiKeyTool } from './admin-create-api-key.js';
import { registerAdminRevokeApiKeyTool } from './admin-revoke-api-key.js';
import { registerAdminDeleteUserTool } from './admin-delete-user.js';

// Re-export for external use
export {
  registerAdminListUsersTool,
  registerAdminCreateUserTool,
  registerAdminCreateApiKeyTool,
  registerAdminRevokeApiKeyTool,
  registerAdminDeleteUserTool,
};

/**
 * Register all admin tools
 */
export function registerAllAdminTools(): void {
  registerAdminListUsersTool();
  console.log('[tools] Registered: admin_list_users');

  registerAdminCreateUserTool();
  console.log('[tools] Registered: admin_create_user');

  registerAdminCreateApiKeyTool();
  console.log('[tools] Registered: admin_create_api_key');

  registerAdminRevokeApiKeyTool();
  console.log('[tools] Registered: admin_revoke_api_key');

  registerAdminDeleteUserTool();
  console.log('[tools] Registered: admin_delete_user');
}
