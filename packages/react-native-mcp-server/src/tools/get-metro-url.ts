/**
 * MCP 도구: get_metro_url
 * CDP 도구(list_console_messages, list_network_requests)에서 사용 중인 Metro base URL 반환
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMetroBaseUrl } from './metro-cdp.js';

export function registerGetMetroUrl(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'get_metro_url',
    {
      description:
        'CDP 이벤트(list_console_messages, list_network_requests)에 사용 중인 Metro base URL 반환. 연결된 앱에서 가져오거나, 없으면 METRO_BASE_URL env 또는 http://localhost:8230.',
      inputSchema: z.object({}),
    },
    async () => {
      const url = getMetroBaseUrl();
      return { content: [{ type: 'text' as const, text: url }] };
    }
  );
}
