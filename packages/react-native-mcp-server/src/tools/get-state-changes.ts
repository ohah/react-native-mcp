/**
 * MCP 도구: get_state_changes
 * 상태 변경 이력 조회. sourceRef 있으면 소스맵으로 파일/라인 추론해 표시. 비우기는 clear(target: 'state_changes').
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';
import { getSourcePosition } from '../symbolicate.js';

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
      description: 'List captured state changes. Filter by component, since, limit.',
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
        const isAppSource = (source: string) =>
          !source.includes('node_modules/react') &&
          !source.includes('node_modules/react-native') &&
          !source.includes('runtime.js');
        const resolveEntrySource = async (entry: {
          sourceRef?: Array<{ bundleUrl: string; line: number; column: number }>;
        }): Promise<string | null> => {
          const refs = entry.sourceRef;
          if (!refs || refs.length === 0) return null;
          for (const ref of refs) {
            const pos = await getSourcePosition(ref.bundleUrl, ref.line, ref.column, {
              useCache: true,
            });
            if (!pos.ok) continue;
            if (pos.source != null && isAppSource(pos.source)) {
              return `${pos.source}:${pos.line ?? 0}:${pos.column ?? 0}`;
            }
          }
          const first = await getSourcePosition(
            refs[0]!.bundleUrl,
            refs[0]!.line,
            refs[0]!.column,
            {
              useCache: true,
            }
          );
          if (first.ok && first.source != null)
            return `${first.source}:${first.line ?? 0}:${first.column ?? 0}`;
          return null;
        };
        const resolved = await Promise.all(
          list.map(
            (e: { sourceRef?: Array<{ bundleUrl: string; line: number; column: number }> }) =>
              resolveEntrySource(e)
          )
        );
        const lines = list.map(
          (
            entry: {
              id?: number;
              timestamp?: number;
              component?: string;
              hookIndex?: number;
              prev?: unknown;
              next?: unknown;
            },
            i: number
          ) => {
            const ts = entry.timestamp ? new Date(entry.timestamp).toISOString() : '?';
            const loc = resolved[i];
            const locStr = loc ? ` @ ${loc}` : '';
            return `[${entry.id}] ${ts} ${entry.component}[hook ${entry.hookIndex}]${locStr}: ${JSON.stringify(entry.prev)} → ${JSON.stringify(entry.next)}`;
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
