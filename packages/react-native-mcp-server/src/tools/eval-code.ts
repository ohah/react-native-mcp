/**
 * MCP 도구: evaluate_script
 * Chrome DevTools MCP 스펙. function + args를 앱에서 실행 (WebSocket eval)
 * @see docs/chrome-devtools-mcp-spec-alignment.md
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  function: z
    .string()
    .describe('앱에서 실행할 JavaScript 함수 (예: () => document.title 또는 (x) => x + 1)'),
  args: z.array(z.unknown()).optional().describe('함수에 넘길 인자 배열'),
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
 * evaluate_script: Chrome DevTools MCP와 동일 (function, args). 앱에 코드 전송 후 결과 반환.
 */
export function registerEvaluateScript(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'evaluate_script',
    {
      description:
        'React Native 앱 컨텍스트에서 JavaScript 함수 실행. Chrome DevTools MCP와 동일: function(문자열), args(배열). JSON 직렬 가능한 결과 반환.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { function: fnStr, args: fnArgs } = schema.parse(args);

      if (!appSession.isConnected()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
            },
          ],
        };
      }

      const argsJson = JSON.stringify(fnArgs ?? []);
      const code = `(function(){try{var __f=(${fnStr});return __f.apply(null,${argsJson});}catch(e){return e.message||String(e);}})()`;

      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        return { content: [{ type: 'text' as const, text: formatResult(res.result) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `evaluate_script failed: ${message}` }] };
      }
    }
  );
}
