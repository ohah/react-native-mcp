/**
 * MCP 도구: eval_code
 * DESIGN.md Phase 1 — 앱 컨텍스트에서 코드 실행 (WebSocket으로 앱에 전달)
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  code: z.string().describe('JavaScript code to run in the React Native app context'),
});

function formatResult(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/**
 * eval_code 도구 등록: 연결된 앱에 코드 전송 후 결과 반환
 */
export function registerEvalCode(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'eval_code',
    {
      description:
        'Run JavaScript code in the React Native app context. Requires the app to be running with Metro and connected to this MCP server (Phase 1).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { code } = schema.parse(args);

      if (!appSession.isConnected()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro (e.g. npx react-native start) and ensure the MCP runtime is loaded (entry file uses AppRegistry.registerComponent).',
            },
          ],
        };
      }

      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
        if (res.error != null) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${res.error}` }],
          };
        }
        return {
          content: [{ type: 'text' as const, text: formatResult(res.result) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Request failed: ${message}` }],
        };
      }
    }
  );
}
