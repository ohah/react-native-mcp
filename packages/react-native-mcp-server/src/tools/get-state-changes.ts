/**
 * MCP 도구: get_state_changes, clear_state_changes
 * onCommitFiberRoot에서 수집된 상태 변경 이력을 조회/초기화.
 * runtime.js의 getStateChanges / clearStateChanges를 eval로 호출.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const listSchema = z.object({
  component: z
    .string()
    .optional()
    .describe('Filter by component name (exact match). Omit for all components.'),
  since: z.number().optional().describe('Return only changes after this timestamp (ms epoch).'),
  limit: z.number().optional().describe('Max number of changes to return (default 100).'),
  deviceId: deviceParam,
  platform: platformParam,
});

const clearSchema = z.object({
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
        'List React state changes captured via fiber tree diff. Each entry includes timestamp, component name, hook index, previous value, and new value. Filter by component name, timestamp, or limit. Buffer holds up to 300 entries.',
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

  s.registerTool(
    'clear_state_changes',
    {
      description: 'Clear all captured state change entries from the buffer.',
      inputSchema: clearSchema,
    },
    async (args: unknown) => {
      const parsed = clearSchema.safeParse(args ?? {});
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

      const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearStateChanges) { __REACT_NATIVE_MCP__.clearStateChanges(); return true; } return false; })();`;

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
        return { content: [{ type: 'text' as const, text: 'State changes cleared.' }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `clear_state_changes failed: ${message}` }],
        };
      }
    }
  );
}
