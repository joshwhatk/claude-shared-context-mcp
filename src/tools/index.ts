/**
 * Tool registration hub
 * Registers all MCP tools with the server
 */

import { registerReadContextTool } from './read-context.js';
import { registerWriteContextTool } from './write-context.js';
import { registerDeleteContextTool } from './delete-context.js';
import { registerListContextTool } from './list-context.js';
import { registerReadAllContextTool } from './read-all.js';

/**
 * Register all MCP tools with the server
 */
export function registerAllTools(): void {
  console.log('[tools] Registering MCP tools...');

  registerReadContextTool();
  console.log('[tools] Registered: read_context');

  registerWriteContextTool();
  console.log('[tools] Registered: write_context');

  registerDeleteContextTool();
  console.log('[tools] Registered: delete_context');

  registerListContextTool();
  console.log('[tools] Registered: list_context');

  registerReadAllContextTool();
  console.log('[tools] Registered: read_all_context');

  console.log('[tools] All 5 MCP tools registered successfully');
}
