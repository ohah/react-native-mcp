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
        'MCP connection status. appConnected: true when app is connected to MCP server (snapshot/click/scroll/eval available). devices: list of connected devices with deviceId, platform, deviceName.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args ?? {});
      const appConnected = appSession.isConnected();
      const devices = appSession.getConnectedDevices();
      const status = {
        appConnected,
        devices,
      };
      const text = [
        `appConnected: ${appConnected}`,
        `devices: ${devices.length > 0 ? devices.map((d) => `${d.deviceId}(${d.platform}${d.deviceName ? ', ' + d.deviceName : ''})`).join(', ') : 'none'}`,
      ].join('\n');
      return {
        content: [
          { type: 'text' as const, text: JSON.stringify(status, null, 2) },
          { type: 'text' as const, text },
        ],
      };
    }
  );
}
