/**
 * MCP 도구: evaluate_script
 * Chrome DevTools MCP 스펙. function + args를 앱에서 실행 (WebSocket eval)
 * @see docs/chrome-devtools-mcp-spec-alignment.md
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  function: z
    .string()
    .describe(
      'JavaScript function to run in the app (e.g. "(x) => x + 1", "() => measureView(uid)"). require() is not available in RN runtime.'
    ),
  args: z.array(z.unknown()).optional().describe('Array of arguments to pass to the function.'),
  deviceId: deviceParam,
  platform: platformParam,
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
        'Run a JavaScript function in the React Native app context. function (string), args (array). Returns JSON-serializable result. Use measureView(uid) to get element coordinates for tap/swipe. Note: require() is not available — use only in-app globals.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { function: fnStr, args: fnArgs, deviceId, platform } = schema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
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
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          10000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        return { content: [{ type: 'text' as const, text: formatResult(res.result) }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `evaluate_script failed: ${message}` }],
        };
      }
    }
  );
}
