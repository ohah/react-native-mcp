/**
 * MCP 도구: inspect_state
 * 셀렉터로 찾은 컴포넌트의 React state Hook 목록을 반환.
 * runtime.js의 inspectState(selector)를 eval로 호출.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  selector: z.string().describe('Selector for component (e.g. CartScreen, #cart-view).'),
  deviceId: deviceParam,
  platform: platformParam,
});

type ServerWithRegisterTool = {
  registerTool(
    name: string,
    def: { description: string; inputSchema: z.ZodTypeAny },
    handler: (args: unknown) => Promise<unknown>
  ): void;
};

export function registerInspectState(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  s.registerTool(
    'inspect_state',
    {
      description: 'Inspect React state hooks by selector. Works with useState, Zustand, etc.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const parsed = schema.safeParse(args ?? {});
      if (!parsed.success) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Invalid arguments: ${parsed.error.message}` }],
        };
      }
      const { selector, deviceId, platform } = parsed.data;

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

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.inspectState ? __REACT_NATIVE_MCP__.inspectState(${JSON.stringify(selector)}) : null; })();`;

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
        if (!res.result) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `No component found for selector: ${selector}`,
              },
            ],
          };
        }
        const result = res.result as {
          component: string;
          hooks: Array<{ index: number; type: string; value: unknown }>;
        };
        const lines = [`Component: ${result.component}`, `State hooks: ${result.hooks.length}`];
        for (const hook of result.hooks) {
          lines.push(`  [${hook.index}] ${hook.type}: ${JSON.stringify(hook.value, null, 2)}`);
        }
        return {
          content: [{ type: 'text' as const, text: lines.join('\n') }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `inspect_state failed: ${message}` }],
        };
      }
    }
  );
}
