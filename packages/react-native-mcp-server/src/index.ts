#!/usr/bin/env node
/**
 * React Native MCP 서버 진입점
 * Stdio transport (Cursor 연동) + WebSocket 서버 (앱 연동)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appSession } from './websocket-server.js';
import { registerAllTools } from './tools/index.js';

export const VERSION = '0.1.0';

const WS_PORT = 12300;

/**
 * MCP 서버 시작
 */
async function main() {
  appSession.start(WS_PORT);

  const server = new McpServer({
    name: 'react-native-mcp-server',
    version: VERSION,
  });

  registerAllTools(server, appSession);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[react-native-mcp-server] Running on stdio');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
