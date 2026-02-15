/**
 * MCP 도구: idb_key
 * idb ui key — iOS 시뮬레이터에 HID 키코드 전송.
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
  keycode: z
    .number()
    .describe(
      'HID keycode to send. Common: 40=Return/Enter, 42=Backspace, 43=Tab, 44=Space, 41=Escape.'
    ),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbKey(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_key',
    {
      description:
        'Send HID keycode to iOS simulator via idb. Common keycodes: 40=Return, 42=Backspace, 43=Tab, 44=Space, 41=Escape.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { keycode, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        await runIdbCommand(['ui', 'key', String(keycode)], targetUdid);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Sent keycode ${keycode} on simulator ${targetUdid}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_key failed: ${message}` }],
        };
      }
    }
  );
}
