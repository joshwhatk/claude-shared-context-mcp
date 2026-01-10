import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Create and configure the MCP server instance
export const server = new McpServer({
  name: 'mcp-shared-context',
  version: '1.0.0',
});

// Re-export for use in transport layer
export { server as mcpServer };
