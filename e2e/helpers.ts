import { spawn } from 'child_process';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';

const SERVER_CWD = path.resolve(import.meta.dirname, '../packages/react-native-mcp-server');

/**
 * MCP 서버를 spawn하고 클라이언트로 연결.
 * 반환된 client와 transport는 테스트 종료 시 close() 필요.
 */
export async function createMcpClient(): Promise<{
  client: Client;
  transport: StdioClientTransport;
}> {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: ['dist/index.js'],
    cwd: SERVER_CWD,
  });

  const client = new Client({
    name: 'e2e-test',
    version: '1.0.0',
  });

  await client.connect(transport);
  return { client, transport };
}

const E2E_ROOT = path.resolve(import.meta.dirname, '..');

/**
 * E2E 플랫폼에 맞게 데모앱을 실행한다.
 * MCP 서버가 먼저 떠 있어야 앱이 ws://localhost:12300에 연결 가능하므로,
 * createMcpClient() 호출 후에 호출할 것.
 */
export function launchApp(platform: 'ios' | 'android'): Promise<void> {
  return new Promise((resolve, reject) => {
    const cmd =
      platform === 'ios'
        ? { file: 'xcrun', args: ['simctl', 'launch', 'booted', 'org.reactnativemcp.demo'] }
        : {
            file: 'adb',
            args: ['shell', 'am', 'start', '-n', 'com.reactnativemcp.demo/.MainActivity'],
          };
    const child = spawn(cmd.file, cmd.args, {
      cwd: E2E_ROOT,
      stdio: 'inherit',
    });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(new Error(`${cmd.file} exit ${code}`))
    );
  });
}

/**
 * 앱이 MCP 서버에 연결될 때까지 polling 대기.
 * 앱이 WebSocket 연결 후 init 메시지를 보내야 appConnected가 true가 됨.
 */
export async function waitForAppConnection(
  client: Client,
  timeoutMs = 90_000,
  intervalMs = 2_000
): Promise<void> {
  const start = Date.now();
  let lastStatus: unknown = null;
  while (Date.now() - start < timeoutMs) {
    const res = await callTool(client, 'get_debugger_status', {});
    lastStatus = res;
    if (res.appConnected) return;
    await sleep(intervalMs);
  }
  const statusJson = JSON.stringify(lastStatus, null, 2);
  const hint =
    process.env.E2E_PLATFORM === 'ios'
      ? 'App must start after MCP server. iOS Simulator: ensure app is launched by the test (server first).'
      : 'App must start after MCP server. Android: adb reverse tcp:12300 tcp:12300 and launch app after server is up.';
  throw new Error(
    `App did not connect within ${timeoutMs / 1000}s. ${hint} Last get_debugger_status: ${statusJson}`
  );
}

/**
 * MCP 도구 호출 + 결과 파싱.
 * content[0].text를 JSON.parse 시도, 실패 시 원본 문자열 반환.
 */
export async function callTool(
  client: Client,
  name: string,
  args: Record<string, unknown>
): Promise<any> {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ type: string; text: string }>)[0]?.text;
  if (!text) return res.content;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
