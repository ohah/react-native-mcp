/**
 * MCP 도구: scroll
 * 등록된 ScrollView ref(testID)로 scrollTo 호출. 앱에서 registerScrollRef(testID, ref) 필요.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  uid: z
    .string()
    .describe(
      'testID or path of the ScrollView. Get from take_snapshot or query_selector first — uids are not known in advance.'
    ),
  y: z.number().optional().describe('Vertical offset in pixels. Default 0.'),
  x: z.number().optional().describe('Horizontal offset in pixels. Default 0.'),
  animated: z.boolean().optional().describe('Whether to animate. Default true.'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerScroll(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'scroll',
    {
      description:
        'Scroll the ScrollView with the given uid. Get uid from take_snapshot or query_selector first (uids are not known in advance). Uses scrollTo({ x, y, animated }).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { uid, y, x, animated, deviceId, platform } = schema.parse(args);

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

      const options = { x: x ?? 0, y: y ?? 0, animated: animated !== false };
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.scrollTo ? __REACT_NATIVE_MCP__.scrollTo(${JSON.stringify(uid)}, ${JSON.stringify(options)}) : { ok: false, error: 'scrollTo not available' }; })();`;
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
        const out = res.result as { ok?: boolean; error?: string } | undefined;
        const ok = out && typeof out.ok === 'boolean' ? out.ok : false;
        const text = ok
          ? `scrolled to x=${options.x}, y=${options.y}`
          : out && out.error
            ? out.error
            : 'scrollTo failed';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `scroll failed: ${message}` }] };
      }
    }
  );
}
