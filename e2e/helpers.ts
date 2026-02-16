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

/**
 * 앱이 MCP 서버에 연결될 때까지 polling 대기.
 */
export async function waitForAppConnection(
  client: Client,
  timeoutMs = 60_000,
  intervalMs = 2_000
): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await callTool(client, 'get_debugger_status', {});
    if (res.appConnected) return;
    await sleep(intervalMs);
  }
  throw new Error(
    `App did not connect within ${timeoutMs / 1000}s. Check that the app is running and adb reverse tcp:12300 tcp:12300 is set.`
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
