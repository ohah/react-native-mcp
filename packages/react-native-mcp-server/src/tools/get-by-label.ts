/**
 * MCP 도구: get_by_label, get_by_labels
 * getByLabel(label) / getByLabels() 결과 반환. 훅 존재 여부, onPress 노드 라벨 목록 확인용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  label: z
    .string()
    .optional()
    .describe('찾을 라벨(부분 문자열). 생략 시 훅 상태와 전체 라벨 목록만 반환.'),
});

function runGetByLabel(
  appSession: AppSession,
  method: 'getByLabel' | 'getByLabels',
  label?: string
) {
  const code =
    method === 'getByLabels'
      ? `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getByLabels ? __REACT_NATIVE_MCP__.getByLabels() : null; })();`
      : `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getByLabel ? __REACT_NATIVE_MCP__.getByLabel(${JSON.stringify(label ?? '')}) : null; })();`;
  return appSession.sendRequest({ method: 'eval', params: { code } });
}

export function registerGetByLabel(server: McpServer, appSession: AppSession): void {
  const register = (
    name: string,
    description: string,
    handler: (args: unknown) => Promise<unknown>
  ) => {
    (
      server as {
        registerTool(
          name: string,
          def: { description: string; inputSchema: z.ZodTypeAny },
          handler: (args: unknown) => Promise<unknown>
        ): void;
      }
    ).registerTool(name, { description, inputSchema: schema }, handler);
  };

  const handle = async (method: 'getByLabel' | 'getByLabels', args: unknown) => {
    if (!appSession.isConnected()) {
      return {
        content: [{ type: 'text' as const, text: 'No React Native app connected.' }],
      };
    }
    const label = method === 'getByLabel' ? schema.parse(args ?? {}).label : undefined;
    try {
      const res = await runGetByLabel(appSession, method, label);
      if (res.error != null) {
        return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
      }
      const data = res.result;
      const text = data == null ? 'not available' : JSON.stringify(data, null, 2);
      return { content: [{ type: 'text' as const, text }] };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: [{ type: 'text' as const, text: `failed: ${message}` }] };
    }
  };

  register(
    'get_by_label',
    'Fiber 라벨 검색 디버그: hookPresent, rendererPresent, rootPresent, labelsWithOnPress, match 반환. click_by_label이 안 될 때 원인 확인용.',
    (args) => handle('getByLabel', args)
  );

  register(
    'get_by_labels',
    'Fiber에서 onPress 있는 노드 전체 목록(훅 상태 + labelsWithOnPress) 반환. getByLabels()와 동일.',
    () => handle('getByLabels', null)
  );
}
