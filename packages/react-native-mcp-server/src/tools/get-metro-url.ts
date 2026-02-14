/**
 * MCP 도구: get_metro_url
 * Metro 번들러 base URL 반환. 디바이스별 URL 조회 가능.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { getMetroBaseUrl } from './metro-cdp.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  deviceId: deviceParam,
  platform: platformParam,
});

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
        'Return Metro base URL used for the connected app. From connected app, or METRO_BASE_URL env, or http://localhost:8230. Multi-device: specify deviceId (e.g. "ios-1") or platform to target a specific device.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const parsed = schema.safeParse(args ?? {});
      const deviceId = parsed.success ? parsed.data.deviceId : undefined;
      const url = getMetroBaseUrl(deviceId);
      return { content: [{ type: 'text' as const, text: url }] };
    }
  );
}
