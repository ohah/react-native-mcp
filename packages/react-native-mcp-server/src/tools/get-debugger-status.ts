/**
 * MCP 도구: get_debugger_status
 * 앱↔MCP 연결(appConnected)과 MCP↔Metro CDP 연결(cdpConnected) 상태 확인.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { getDebuggerStatus } from './metro-cdp.js';

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
        'MCP 연결 상태 확인. appConnected: 앱이 MCP 서버에 붙어 있으면 true (스냅샷/클릭/스크롤/eval 사용 가능). cdpConnected: Metro CDP 연결이면 true (콘솔/네트워크 이벤트 수집 가능).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args ?? {});
      const cdp = await getDebuggerStatus();
      const appConnected = appSession.isConnected();
      const status = {
        appConnected,
        cdpConnected: cdp.connected,
        lastEventTimestamp: cdp.lastEventTimestamp,
        eventCount: cdp.eventCount,
      };
      const text = [
        `appConnected: ${appConnected}`,
        `cdpConnected: ${cdp.connected}`,
        `lastEventTimestamp: ${cdp.lastEventTimestamp ?? 'null'}`,
        `eventCount: ${cdp.eventCount}`,
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
