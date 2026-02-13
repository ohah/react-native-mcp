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
        'Return the Metro base URL used for CDP events (list_console_messages, list_network_requests). From connected app when available, else METRO_BASE_URL env or http://localhost:8230.',
      inputSchema: z.object({}),
    },
    async () => {
      const url = getMetroBaseUrl();
      return { content: [{ type: 'text' as const, text: url }] };
    }
  );
}
