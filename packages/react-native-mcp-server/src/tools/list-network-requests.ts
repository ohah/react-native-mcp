/**
 * MCP 도구: list_network_requests, clear_network_requests
 * XHR/fetch monkey-patch를 통해 캡처된 네트워크 요청을 조회/초기화.
 * runtime.js의 getNetworkRequests / clearNetworkRequests를 eval로 호출.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const listSchema = z.object({
  url: z.string().optional().describe('URL substring filter.'),
  method: z.string().optional().describe('HTTP method filter (GET, POST, etc.).'),
  status: z.number().optional().describe('Status code filter (200, 404, etc.).'),
  since: z.number().optional().describe('Return only requests after this timestamp (ms).'),
  limit: z.number().optional().describe('Max number of requests to return (default 50).'),
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

export function registerListNetworkRequests(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  s.registerTool(
    'list_network_requests',
    {
      description:
        'List network requests captured via XHR/fetch monkey-patch. Filter by URL, method, status, timestamp, or limit. Returns request/response details including headers and body.',
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
        if (parsed.data.url != null) options.url = parsed.data.url;
        if (parsed.data.method != null) options.method = parsed.data.method;
        if (parsed.data.status != null) options.status = parsed.data.status;
        if (parsed.data.since != null) options.since = parsed.data.since;
        if (parsed.data.limit != null) options.limit = parsed.data.limit;
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getNetworkRequests ? __REACT_NATIVE_MCP__.getNetworkRequests(${JSON.stringify(options)}) : []; })();`;

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
          return { content: [{ type: 'text' as const, text: 'No network requests.' }] };
        }
        const lines = list.map(
          (entry: {
            id?: number;
            method?: string;
            url?: string;
            status?: number | null;
            statusText?: string | null;
            duration?: number | null;
            error?: string | null;
            state?: string;
            requestBody?: string | null;
            responseBody?: string | null;
          }) => {
            const status = entry.status != null ? String(entry.status) : '-';
            const duration = entry.duration != null ? `${entry.duration}ms` : 'pending';
            const error = entry.error ? ` [${entry.error}]` : '';
            return `[${entry.id}] ${entry.method} ${entry.url} → ${status} (${duration})${error}`;
          }
        );
        return {
          content: [
            { type: 'text' as const, text: `${list.length} request(s):\n${lines.join('\n')}` },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `list_network_requests failed: ${message}` }],
        };
      }
    }
  );

  s.registerTool(
    'clear_network_requests',
    {
      description: 'Clear all captured network requests from the buffer.',
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

      const code = `(function(){ if (typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.clearNetworkRequests) { __REACT_NATIVE_MCP__.clearNetworkRequests(); return true; } return false; })();`;

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
        return { content: [{ type: 'text' as const, text: 'Network requests cleared.' }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `clear_network_requests failed: ${message}` }],
        };
      }
    }
  );
}
