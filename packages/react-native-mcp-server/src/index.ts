#!/usr/bin/env node
/**
 * React Native MCP 서버 진입점
 * Stdio transport (Cursor 연동) + WebSocket 서버 (앱 연동)
 *
 * `init` 서브커맨드: 프로젝트 셋업 CLI
 * `test` 서브커맨드: YAML E2E 테스트 실행
 * `doctor` 서브커맨드: 도입 환경 검사 (Node/RN 버전, idb/adb 등)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { appSession } from './websocket-server.js';
import { startHealthServer } from './health-server.js';
import { registerAllTools } from './tools/index.js';
import { registerAllResources } from './resources/index.js';
import { VERSION } from './version.js';

export { VERSION };

const WS_PORT = 12300;

/**
 * MCP 서버 시작
 */
async function main() {
  appSession.start(WS_PORT);
  startHealthServer(appSession, WS_PORT);

  const server = new McpServer({
    name: 'react-native-mcp-server',
    version: VERSION,
  });

  registerAllTools(server, appSession);
  registerAllResources(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[react-native-mcp-server] Running on stdio');

  // 프로세스 종료 시 WebSocket 클라이언트에 정상 close frame 전송 (TCP RST로 인한 앱 크래시 방지)
  const gracefulStop = () => {
    appSession.stop();
    // close frame이 실제 전송될 시간을 확보한 뒤 종료
    setTimeout(() => process.exit(0), 200);
  };
  process.once('SIGINT', gracefulStop);
  process.once('SIGTERM', gracefulStop);
}

const subcommand = process.argv[2];

if (subcommand === 'test') {
  // 'test' 토큰 제거 → test CLI가 "run <path> ..." 를 argv[2]로 받도록
  process.argv = [process.argv[0], process.argv[1], ...process.argv.slice(3)];
  await import('./test/cli.js');
} else if (subcommand === 'doctor') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const doctorScript = path.join(__dirname, '..', 'scripts', 'doctor.mjs');
  const r = spawnSync(process.execPath, [doctorScript], {
    stdio: 'inherit',
    cwd: process.cwd(),
  });
  process.exit(r.status ?? 1);
} else if (subcommand === 'init') {
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
      app: { type: 'string' },
      yes: { type: 'boolean', short: 'y', default: false },
      'no-install': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });

  if (values.help) {
    console.log(`
Usage: react-native-mcp-server init [options]

Options:
  --client <name>    MCP client: cursor, claude-code, claude-desktop, windsurf, antigravity
  --app <path>       In a monorepo, path to the React Native app (e.g. examples/demo-app)
  -y, --yes          Skip prompts (non-interactive mode)
  --no-install       Add package to package.json only; do not run install
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
      await runInit({
        client,
        interactive: !values.yes,
        appPath: values.app,
        noInstall: values['no-install'],
      });
    }
  }
} else {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
