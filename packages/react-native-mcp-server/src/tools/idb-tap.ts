/**
 * MCP 도구: idb_tap
 * idb ui tap — iOS 시뮬레이터에 좌표 탭 주입.
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
  x: z.number().describe('X coordinate in points (not pixels).'),
  y: z.number().describe('Y coordinate in points (not pixels).'),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbTap(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_tap',
    {
      description:
        'Tap at (x, y) coordinates on iOS simulator via idb. Coordinates are in points (not pixels). Use evaluate_script with measureView(testID) to get element coordinates first. After tapping, verify with assert_text instead of take_screenshot to save tokens.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { x, y, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        await runIdbCommand(['ui', 'tap', String(x), String(y)], targetUdid);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tapped at (${x}, ${y}) on simulator ${targetUdid}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_tap failed: ${message}` }],
        };
      }
    }
  );
}
