/**
 * MCP 도구: get_state_changes
 * 상태 변경 이력 조회. 비우기는 clear(target: 'state_changes').
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const listSchema = z.object({
  component: z.string().optional().describe('Filter by component name. Omit for all.'),
  since: z.number().optional().describe('Only changes after timestamp (ms).'),
  limit: z.number().optional().describe('Max changes to return. Default 100.'),
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

export function registerGetStateChanges(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  s.registerTool(
    'get_state_changes',
    {
      description:
        'List captured state changes (timestamp, component, hook, prev/next). Filter by component, since, limit. Buffer up to 300.',
      inputSchema: listSchema,
    },
    async (args: unknown) => {
      const parsed = listSchema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const platform = parsed.success ? parsed.data.platform : undefined;

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

      const options: Record<string, unknown> = {};
      if (parsed.success) {
        if (parsed.data.component != null) options.component = parsed.data.component;
        if (parsed.data.since != null) options.since = parsed.data.since;
        if (parsed.data.limit != null) options.limit = parsed.data.limit;
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getStateChanges ? __REACT_NATIVE_MCP__.getStateChanges(${JSON.stringify(options)}) : []; })();`;

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
        const list = Array.isArray(res.result) ? res.result : [];
        if (list.length === 0) {
          return { content: [{ type: 'text' as const, text: 'No state changes recorded.' }] };
        }
        const lines = list.map(
          (entry: {
            id?: number;
            timestamp?: number;
            component?: string;
            hookIndex?: number;
            prev?: unknown;
            next?: unknown;
          }) => {
            const ts = entry.timestamp ? new Date(entry.timestamp).toISOString() : '?';
            return `[${entry.id}] ${ts} ${entry.component}[hook ${entry.hookIndex}]: ${JSON.stringify(entry.prev)} → ${JSON.stringify(entry.next)}`;
          }
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `${list.length} state change(s):\n${lines.join('\n')}`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `get_state_changes failed: ${message}` }],
        };
      }
    }
  );
}
