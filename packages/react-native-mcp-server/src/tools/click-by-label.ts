/**
 * MCP 도구: click_by_label
 * Fiber 트리에서 라벨(텍스트)에 해당하는 첫 번째 onPress 노드를 찾아 호출. testID 없어도 동작.
 * __REACT_DEVTOOLS_GLOBAL_HOOK__ 있을 때만 동작.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  label: z.string().describe('텍스트(라벨) 부분 문자열. 이 텍스트를 포함한 버튼의 onPress 호출.'),
});

export function registerClickByLabel(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'click_by_label',
    {
      description:
        'Fiber 노드로 라벨(텍스트)이 일치하는 요소를 찾아 클릭. testID 없는 버튼도 가능. DevTools 훅 필요.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { label } = schema.parse(args);

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

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.pressByLabel && __REACT_NATIVE_MCP__.pressByLabel(${JSON.stringify(label)}); })();`;
      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        const fired = res.result === true;
        const text = fired
          ? 'pressed (Fiber에서 라벨로 찾아 onPress 호출됨)'
          : 'No matching button. DevTools 훅이 있나요? 라벨 문자열이 화면 텍스트에 포함돼 있나요?';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `click_by_label failed: ${message}` }] };
      }
    }
  );
}
