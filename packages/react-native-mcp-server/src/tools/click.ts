/**
 * MCP 도구: click
 * Chrome DevTools MCP 스펙. testID(uid)로 요소 클릭. 내부적으로 triggerPress 호출.
 * @see docs/chrome-devtools-mcp-spec-alignment.md
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  uid: z.string().describe('testID of the element (from snapshot or Babel-injected id)'),
  dblClick: z.boolean().optional().describe('Double-click. Default false.'),
  includeSnapshot: z.boolean().optional().describe('Include snapshot in response. Ignored on RN.'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerClick(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'click',
    {
      description:
        'Click the element with the given testID (uid). Calls triggerPress in the app. Use with Pressable/TouchableOpacity testID or Babel-injected testID.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { uid, dblClick, deviceId, platform } = schema.parse(args);

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

      const triggerCode = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.triggerPress && __REACT_NATIVE_MCP__.triggerPress(${JSON.stringify(uid)}); })();`;
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code: triggerCode } },
          10000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        if (dblClick) {
          await appSession.sendRequest(
            { method: 'eval', params: { code: triggerCode } },
            10000,
            deviceId,
            platform
          );
          return { content: [{ type: 'text' as const, text: 'pressed twice (dblClick)' }] };
        }
        const fired = res.result === true;
        const text = fired
          ? 'pressed'
          : 'No handler for this testID (element may not have onPress + testID, or Babel transform not applied).';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `click failed: ${message}` }] };
      }
    }
  );
}
