/**
 * MCP 도구: take_snapshot
 * Chrome DevTools MCP 스펙 정렬. a11y 대신 Fiber 컴포넌트 트리(타입/testID/자식) 기반 스냅샷.
 * querySelector 대체: 트리에서 ScrollView, FlatList, Text 등 타입·uid로 요소 탐색.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  maxDepth: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .describe('트리 깊이 제한. 기본 30. 큰 앱에서 페이로드 방지'),
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
        'React Native Fiber에서 컴포넌트 트리 스냅샷 캡처. uid, type(ScrollView, FlatList, Text, View 등), testID, accessibilityLabel, text 포함. querySelector처럼 탐색할 때 사용. uid는 testID가 있으면 testID, 없으면 경로(예: "0.1.2"); uid가 testID일 때 click(uid) 사용.',
      inputSchema: schema,
    },
    async (args) => {
      if (!appSession.isConnected()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
            },
          ],
        };
      }
      const parsed = schema.safeParse(args ?? {});
      const maxDepth = parsed.success && parsed.data.maxDepth != null ? parsed.data.maxDepth : 30;
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getComponentTree ? __REACT_NATIVE_MCP__.getComponentTree({ maxDepth: ${maxDepth} }) : null; })();`;
      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
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
