#!/usr/bin/env node
/**
 * React Native MCP 서버 진입점
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

export const VERSION = '0.1.0';

/**
 * MCP 서버 시작
 */
async function main() {
  const server = new McpServer({
    name: 'react-native-mcp-server',
    version: VERSION,
  });

  // TODO: registerAllTools(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[react-native-mcp-server] Running on stdio');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
