/**
 * MCP 도구: set_network_mock, list_network_mocks, remove_network_mock
 * 비우기는 clear(target: 'network_mocks').
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const setSchema = z.object({
  urlPattern: z.string().describe('URL pattern (substring or regex).'),
  isRegex: z.boolean().optional().describe('urlPattern is regex.'),
  method: z.string().optional().describe('HTTP method. Omit to match all.'),
  status: z.number().optional().describe('Mock status. Default 200.'),
  statusText: z.string().optional().describe('Mock status text.'),
  headers: z.record(z.string()).optional().describe('Mock headers.'),
  body: z.string().optional().describe('Mock body.'),
  delay: z.number().optional().describe('Delay ms before mock.'),
  deviceId: deviceParam,
  platform: platformParam,
});

const listSchema = z.object({
  deviceId: deviceParam,
  platform: platformParam,
});

const removeSchema = z.object({
  id: z.number().describe('Mock rule ID to remove.'),
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

function notConnectedResponse() {
  return {
    content: [
      {
        type: 'text' as const,
        text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
      },
    ],
  };
}

export function registerNetworkMock(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  // set_network_mock
  s.registerTool(
    'set_network_mock',
    {
      description: 'Add network mock. Matching XHR/fetch return mock without hitting network.',
      inputSchema: setSchema,
    },
    async (args: unknown) => {
      const parsed = setSchema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const platform = parsed.success ? parsed.data.platform : undefined;

      if (!appSession.isConnected(deviceId, platform)) return notConnectedResponse();

      const opts: Record<string, unknown> = {};
      if (parsed.success) {
        opts.urlPattern = parsed.data.urlPattern;
        if (parsed.data.isRegex != null) opts.isRegex = parsed.data.isRegex;
        if (parsed.data.method != null) opts.method = parsed.data.method;
        if (parsed.data.status != null) opts.status = parsed.data.status;
        if (parsed.data.statusText != null) opts.statusText = parsed.data.statusText;
        if (parsed.data.headers != null) opts.headers = parsed.data.headers;
        if (parsed.data.body != null) opts.body = parsed.data.body;
        if (parsed.data.delay != null) opts.delay = parsed.data.delay;
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.addNetworkMock ? __REACT_NATIVE_MCP__.addNetworkMock(${JSON.stringify(opts)}) : null; })();`;

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
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify(res.result, null, 2),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `set_network_mock failed: ${message}` }],
        };
      }
    }
  );

  // list_network_mocks
  s.registerTool(
    'list_network_mocks',
    {
      description: 'List all active network mock rules.',
      inputSchema: listSchema,
    },
    async (args: unknown) => {
      const parsed = listSchema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const platform = parsed.success ? parsed.data.platform : undefined;

      if (!appSession.isConnected(deviceId, platform)) return notConnectedResponse();

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.listNetworkMocks ? __REACT_NATIVE_MCP__.listNetworkMocks() : []; })();`;

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
          return { content: [{ type: 'text' as const, text: 'No network mock rules.' }] };
        }
        const lines = list.map(
          (r: {
            id?: number;
            urlPattern?: string;
            isRegex?: boolean;
            method?: string | null;
            status?: number;
            enabled?: boolean;
            hitCount?: number;
          }) =>
            `[${r.id}] ${r.method || '*'} ${r.isRegex ? '/' + r.urlPattern + '/' : r.urlPattern} → ${r.status} (hits: ${r.hitCount})`
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `${list.length} mock rule(s):\n${lines.join('\n')}`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `list_network_mocks failed: ${message}` }],
        };
      }
    }
  );

  // remove_network_mock
  s.registerTool(
    'remove_network_mock',
    {
      description: 'Remove a specific network mock rule by ID.',
      inputSchema: removeSchema,
    },
    async (args: unknown) => {
      const parsed = removeSchema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const platform = parsed.success ? parsed.data.platform : undefined;

      if (!appSession.isConnected(deviceId, platform)) return notConnectedResponse();

      const id = parsed.success ? parsed.data.id : 0;
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.removeNetworkMock ? __REACT_NATIVE_MCP__.removeNetworkMock(${JSON.stringify(id)}) : false; })();`;

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
        const removed = res.result === true;
        return {
          content: [
            {
              type: 'text' as const,
              text: removed ? `Mock rule ${id} removed.` : `Mock rule ${id} not found.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `remove_network_mock failed: ${message}` }],
        };
      }
    }
  );
}
