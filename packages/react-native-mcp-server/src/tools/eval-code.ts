/**
 * MCP 도구: eval_code
 * DESIGN.md Phase 1 — 앱 컨텍스트에서 코드 실행. 현재는 앱 연결 전 스텁.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

const schema = z.object({
  code: z.string().describe('JavaScript code to run in the React Native app context'),
});

/**
 * eval_code 도구 등록 (스텁: 앱 WebSocket 연결 후 구현 예정)
 */
export function registerEvalCode(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'eval_code',
    {
      description:
        'Run JavaScript code in the React Native app context. Requires the app to be running with Metro and connected to this MCP server (Phase 1).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args);
      return {
        content: [
          {
            type: 'text' as const,
            text: 'eval_code is not implemented yet. Start the RN app with Metro and connect the runtime to this server.',
          },
        ],
      };
    }
  );
}
