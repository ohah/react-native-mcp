/**
 * MCP 도구: list_console_messages, clear_console_messages
 * nativeLoggingHook을 통해 캡처된 콘솔 로그를 조회/초기화.
 * runtime.js의 getConsoleLogs / clearConsoleLogs를 eval로 호출.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const LEVEL_NAMES: Record<number, string> = { 0: 'log', 1: 'info', 2: 'warn', 3: 'error' };

const listSchema = z.object({
  level: z
    .enum(['log', 'info', 'warn', 'error'])
    .optional()
    .describe('Filter by log level. Omit for all levels.'),
  since: z.number().optional().describe('Return only logs after this timestamp (ms).'),
  limit: z.number().optional().describe('Max number of logs to return (default 100).'),
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

export function registerListConsoleMessages(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  s.registerTool(
    'list_console_messages',
    {
      description:
        'List console messages captured via nativeLoggingHook. Filter by level, timestamp, or limit. Level mapping: 0=log, 1=info, 2=warn, 3=error.',
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
        if (parsed.data.level != null) options.level = parsed.data.level;
        if (parsed.data.since != null) options.since = parsed.data.since;
        if (parsed.data.limit != null) options.limit = parsed.data.limit;
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getConsoleLogs ? __REACT_NATIVE_MCP__.getConsoleLogs(${JSON.stringify(options)}) : []; })();`;

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
          return { content: [{ type: 'text' as const, text: 'No console messages.' }] };
        }
        const lines = list.map(
          (entry: { id?: number; level?: number; message?: string; timestamp?: number }) => {
            const levelName = LEVEL_NAMES[entry.level ?? 0] ?? String(entry.level);
            return `[${entry.id}] ${levelName}: ${entry.message ?? ''}  (${entry.timestamp ?? ''})`;
          }
        );
        return {
          content: [
            { type: 'text' as const, text: `${list.length} message(s):\n${lines.join('\n')}` },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `list_console_messages failed: ${message}` }],
        };
      }
    }
  );

  s.registerTool(
    'clear_console_messages',
    {
      description: 'Clear all captured console messages from the buffer.',
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

      const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearConsoleLogs) { __REACT_NATIVE_MCP__.clearConsoleLogs(); return true; } return false; })();`;

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
        return { content: [{ type: 'text' as const, text: 'Console messages cleared.' }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `clear_console_messages failed: ${message}` }],
        };
      }
    }
  );
}
