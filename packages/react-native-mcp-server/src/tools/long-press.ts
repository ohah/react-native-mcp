/**
 * MCP 도구: long_press
 * testID(uid)로 요소 롱프레스. 내부적으로 triggerLongPress 호출.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  uid: z.string().describe('testID of the element to long-press'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerLongPress(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'long_press',
    {
      description:
        'Long-press the element with the given testID (uid). Calls onLongPress in the app. Use with Pressable/TouchableOpacity that has onLongPress handler.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { uid, deviceId, platform } = schema.parse(args);

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

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.triggerLongPress && __REACT_NATIVE_MCP__.triggerLongPress(${JSON.stringify(uid)}); })();`;
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
        const fired = res.result === true;
        const text = fired
          ? 'long-pressed'
          : 'No handler for this testID (element may not have onLongPress + testID).';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `long_press failed: ${message}` }] };
      }
    }
  );
}
