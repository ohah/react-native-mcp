/**
 * MCP 도구: take_snapshot
 * Chrome DevTools MCP 스펙 정렬. a11y 대신 Fiber 컴포넌트 트리(타입/testID/자식) 기반 스냅샷.
 * querySelector 대체: 트리에서 ScrollView, FlatList, Text 등 타입·uid로 요소 탐색.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('Max tree depth. Default 30. Reduces payload on large apps.'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerTakeSnapshot(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'take_snapshot',
    {
      description:
        'Capture component tree to discover uids. Returns uid, type, testID, accessibilityLabel, text. Auto-generated testIDs follow ComponentName-index-TagName (e.g. LoginForm-0-Button). uid is testID when present, else path like "0.1.2". Workflow: take_snapshot or query_selector → evaluate_script(measureView(uid)) → tap/swipe.',
      inputSchema: schema,
    },
    async (args) => {
      const parsed = schema.safeParse(args ?? {});
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
      const maxDepth = parsed.success && parsed.data.maxDepth != null ? parsed.data.maxDepth : 30;
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getComponentTree ? __REACT_NATIVE_MCP__.getComponentTree({ maxDepth: ${maxDepth} }) : null; })();`;
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
        const tree = res.result;
        const text =
          tree == null
            ? 'Snapshot unavailable (DevTools hook or fiber root missing).'
            : JSON.stringify(tree, null, 2);
        return {
          content: [{ type: 'text' as const, text }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `take_snapshot failed: ${message}` }] };
      }
    }
  );
}
