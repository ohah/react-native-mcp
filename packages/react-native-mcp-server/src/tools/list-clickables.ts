/**
 * MCP 도구: list_clickables
 * 클릭 가능 요소 목록(uid + label) 반환. 텍스트로 찾은 뒤 click(uid) 호출용.
 * Chrome DevTools MCP의 스냅샷/selector 대신, RN은 testID(uid) + Fiber 트리 순회 라벨로 "텍스트로 찾기" 지원.
 * 라벨은 __REACT_DEVTOOLS_GLOBAL_HOOK__ 있을 때만 수집(동적 텍스트 포함). 없으면 빈 문자열.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerListClickables(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'list_clickables',
    {
      description:
        'List clickable elements (uid + label). Search by label text then call click(uid). Labels collected from Fiber tree (runtime text when DevTools hook present).',
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
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getClickables ? __REACT_NATIVE_MCP__.getClickables() : []; })();`;
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
                (item: { uid?: string; label?: string }) =>
                  `${item.uid ?? ''}\t${(item.label ?? '').replace(/\s+/g, ' ')}`
              )
              .join('\n')
          : 'No clickables registered.';
        return {
          content: [
            { type: 'text' as const, text: JSON.stringify(list, null, 2) },
            { type: 'text' as const, text },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `list_clickables failed: ${message}` }] };
      }
    }
  );
}
