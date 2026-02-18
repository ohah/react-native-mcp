#!/usr/bin/env node
/**
 * React Native MCP 서버 진입점
 * Stdio transport (Cursor 연동) + WebSocket 서버 (앱 연동)
 *
 * `init` 서브커맨드: 프로젝트 셋업 CLI
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appSession } from './websocket-server.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';

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
  registerAllResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[react-native-mcp-server] Running on stdio');
}

if (process.argv[2] === 'init') {
  const { parseArgs } = await import('node:util');
  const { runInit } = await import('./init/index.js');
  type McpClient = import('./init/mcp-config.js').McpClient;

  const VALID_CLIENTS = [
    'cursor',
    'claude-code',
    'claude-desktop',
    'windsurf',
    'antigravity',
  ] as const;

  const { values } = parseArgs({
    args: process.argv.slice(3),
    options: {
      client: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`
Usage: react-native-mcp-server init [options]

Options:
  --client <name>    MCP client: cursor, claude-code, claude-desktop, windsurf, antigravity
  -y, --yes          Skip prompts (non-interactive mode)
  --help, -h         Show this help message
`);
  } else {
    let client: McpClient | undefined;
    if (values.client) {
      if (!VALID_CLIENTS.includes(values.client as McpClient)) {
        console.error(`Invalid client: ${values.client}`);
        console.error(`Valid clients: ${VALID_CLIENTS.join(', ')}`);
        process.exitCode = 1;
      } else {
        client = values.client as McpClient;
      }
    }
    if (process.exitCode !== 1) {
      await runInit({ client, interactive: !values.yes });
    }
  }
} else {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
