/**
 * MCP 도구: idb_text
 * idb ui text — iOS 시뮬레이터에 텍스트 입력.
 * 영문/숫자만 안정적. 한글 등 유니코드는 MCP type_text 사용 권장.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkIdbAvailable,
  resolveUdid,
  runIdbCommand,
  idbNotInstalledError,
} from './idb-utils.js';

const schema = z.object({
  text: z
    .string()
    .describe(
      'Text to type into the currently focused input. ASCII only (English/numbers). For Korean/Unicode, use MCP type_text tool instead.'
    ),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbText(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_text',
    {
      description:
        'Type text into the currently focused input on iOS simulator via idb. ASCII only (English, numbers, symbols). For Korean/Unicode input, use MCP type_text tool instead.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { text, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        await runIdbCommand(['ui', 'text', text], targetUdid);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Typed "${text}" on simulator ${targetUdid}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_text failed: ${message}` }],
        };
      }
    }
  );
}
