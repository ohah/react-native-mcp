/**
 * MCP 도구: clear
 * 버퍼/캐시 비우기 5종을 하나의 도구로 통합. target으로 대상 선택.
 * clear_state(앱 데이터 초기화)는 별도 도구로 유지.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const clearSchema = z.object({
  target: z
    .enum(['console', 'network_requests', 'network_mocks', 'state_changes', 'render_profile'])
    .describe(
      'Which buffer to clear: console logs, network requests, network mocks, state changes, or render profile data.'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

const CODES: Record<string, string> = {
  console: `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearConsoleLogs) { __REACT_NATIVE_MCP__.clearConsoleLogs(); return true; } return false; })();`,
  network_requests: `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearNetworkRequests) { __REACT_NATIVE_MCP__.clearNetworkRequests(); return true; } return false; })();`,
  network_mocks: `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearNetworkMocks) { __REACT_NATIVE_MCP__.clearNetworkMocks(); return true; } return false; })();`,
  state_changes: `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearStateChanges) { __REACT_NATIVE_MCP__.clearStateChanges(); return true; } return false; })();`,
  render_profile: `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearRenderProfile) { __REACT_NATIVE_MCP__.clearRenderProfile(); return true; } return false; })();`,
};

const MESSAGES: Record<string, string> = {
  console: 'Console messages cleared.',
  network_requests: 'Network requests cleared.',
  network_mocks: 'Network mock rules cleared.',
  state_changes: 'State changes cleared.',
  render_profile: 'Render profiling stopped and data cleared.',
};

type ServerWithRegisterTool = {
  registerTool(
    name: string,
    def: { description: string; inputSchema: z.ZodTypeAny },
    handler: (args: unknown) => Promise<unknown>
  ): void;
};

export function registerClearBuffers(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  s.registerTool(
    'clear',
    {
      description:
        'Clear one buffer: console logs, network requests, network mocks, state changes, or render profile. Use target param. App data reset is clear_state.',
      inputSchema: clearSchema,
    },
    async (args: unknown) => {
      const parsed = clearSchema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const platform = parsed.success ? parsed.data.platform : undefined;
      const target = parsed.success ? parsed.data.target : undefined;

      if (!target || !parsed.success) {
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `clear failed: invalid args. target required: ${Object.keys(CODES).join(', ')}`,
            },
          ],
        };
      }

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

      const code = CODES[target];
      if (!code) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `clear failed: unknown target "${target}"` }],
        };
      }

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
        return {
          content: [{ type: 'text' as const, text: MESSAGES[target] ?? `${target} cleared.` }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `clear failed: ${message}` }],
        };
      }
    }
  );
}
