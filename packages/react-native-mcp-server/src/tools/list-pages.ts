/**
 * MCP 도구: list_pages
 * Chrome DevTools MCP 스펙. RN은 단일 앱이므로 페이지 1개 반환
 * @see docs/chrome-devtools-mcp-spec-alignment.md
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * list_pages: Chrome DevTools MCP와 동일 (파라미터 없음).
 * React Native는 단일 앱이므로 id=1, title="React Native App" 한 개 반환
 */
export function registerListPages(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'list_pages',
    {
      description:
        '브라우저에서 열린 페이지 목록. React Native는 단일 앱을 한 페이지로 반환(Chrome DevTools MCP 스펙).',
      inputSchema: z.object({}),
    },
    async () => {
      const pages = [{ id: 1, title: 'React Native App', url: 'react-native://app' }];
      const text = `Pages (1):\n${pages.map((p) => `  id=${p.id} title="${p.title}" url=${p.url}`).join('\n')}`;
      return { content: [{ type: 'text' as const, text }] };
    }
  );
}
