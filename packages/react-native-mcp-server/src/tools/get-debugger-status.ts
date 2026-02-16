/**
 * MCP 도구: get_debugger_status
 * 앱↔MCP 연결 상태 확인. 다중 디바이스: 연결된 전체 디바이스 목록 포함.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({});

export function registerGetDebuggerStatus(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'get_debugger_status',
    {
      description:
        'MCP connection status. appConnected: true when app is connected to MCP server (snapshot/eval/tap available). devices: list of connected devices with deviceId, platform, deviceName.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args ?? {});
      const appConnected = appSession.isConnected();
      const devices = appSession.getConnectedDevices();
      const status: {
        appConnected: boolean;
        devices: typeof devices;
        orientation?: string;
        window?: { width: number; height: number };
      } = {
        appConnected,
        devices,
      };
      if (appConnected && devices.length > 0) {
        try {
          const res = await appSession.sendRequest(
            {
              method: 'eval',
              params: {
                code: '(function(){ var M = typeof __REACT_NATIVE_MCP__ !== "undefined" ? __REACT_NATIVE_MCP__ : null; return M && M.getScreenInfo ? M.getScreenInfo() : null; })();',
              },
            },
            5000
          );
          const info = res.result as {
            orientation?: string;
            window?: { width: number; height: number };
          } | null;
          if (info && typeof info === 'object' && info.orientation) {
            status.orientation = info.orientation;
            if (info.window) status.window = info.window;
          }
        } catch {
          // ignore
        }
      }
      const text = [
        `appConnected: ${appConnected}`,
        `devices: ${devices.length > 0 ? devices.map((d) => `${d.deviceId}(${d.platform}${d.deviceName ? ', ' + d.deviceName : ''})`).join(', ') : 'none'}`,
        status.orientation != null ? `orientation: ${status.orientation}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(status, null, 2) },
          { type: 'text' as const, text },
        ],
      };
    }
  );
}
