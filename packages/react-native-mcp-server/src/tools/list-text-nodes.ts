/**
 * MCP 도구: list_text_nodes
 * Fiber 트리 전체에서 Text 노드 내용 수집. 버튼/클릭 여부와 무관하게 화면에 있는 텍스트 목록 반환.
 * DevTools 훅 있을 때만 수집. testID는 해당 Text의 조상 중 가장 가까운 testID(있으면).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerListTextNodes(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'list_text_nodes',
    {
      description:
        'List text node contents from React Native Fiber tree. Returns all visible text (not only clickables). Each item: text, optional testID (nearest ancestor). Requires DevTools hook.',
      inputSchema: schema,
    },
    async (args: unknown) => {
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
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getTextNodes ? __REACT_NATIVE_MCP__.getTextNodes() : []; })();`;
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
        const text = list.length
          ? list
              .map(
                (item: { text?: string; testID?: string }) =>
                  `${item.testID ?? '-'}\t${(item.text ?? '').replace(/\s+/g, ' ')}`
              )
              .join('\n')
          : 'No text nodes (or DevTools hook unavailable).';
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(list, null, 2) },
            { type: 'text' as const, text },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `list_text_nodes failed: ${message}` }] };
      }
    }
  );
}
