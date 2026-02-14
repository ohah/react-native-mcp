/**
 * MCP 도구: list_clickable_text_content
 * onPress 있는 노드별 전체 텍스트(textContent) 목록. querySelector + textContent처럼 검증용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

export function registerListClickableTextContent(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'list_clickable_text_content',
    {
      description:
        'List full text (textContent) per node that has onPress. For verifying button/click-area display text. Returns [{ text, testID? }].',
      inputSchema: z.object({}),
    },
    async () => {
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
      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getClickableTextContent ? __REACT_NATIVE_MCP__.getClickableTextContent() : []; })();`;
      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        const list = Array.isArray(res.result) ? res.result : [];
        const text =
          list.length > 0
            ? JSON.stringify(list, null, 2)
            : 'No clickable nodes (getClickableTextContent returned empty).';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [
            { type: 'text' as const, text: `list_clickable_text_content failed: ${message}` },
          ],
        };
      }
    }
  );
}
