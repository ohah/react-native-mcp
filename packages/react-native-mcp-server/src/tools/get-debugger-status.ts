/**
 * MCP 도구: get_debugger_status
 * Metro CDP 이벤트의 마지막 발생 시각으로 디버거(DevTools) 연결 여부를 추정.
 * 최근 N초(기본 60초) 안에 이벤트가 있으면 connected: true.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getDebuggerStatus } from './metro-cdp.js';

const schema = z.object({});

export function registerGetDebuggerStatus(server: McpServer): void {
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
        'MCP 서버의 CDP WebSocket 연결 상태 확인. connected: true면 콘솔/네트워크 이벤트 수집 중.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args ?? {});
      const status = await getDebuggerStatus();
      const text = [
        `connected: ${status.connected}`,
        `lastEventTimestamp: ${status.lastEventTimestamp ?? 'null'}`,
        `eventCount: ${status.eventCount}`,
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
