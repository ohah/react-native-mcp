/**
 * MCP 도구: idb_swipe
 * idb ui swipe — iOS 시뮬레이터에 스와이프 제스처 주입.
 * RNGH Gesture.Pan, 드로워, 페이저, 바텀시트 등 네이티브 제스처 트리거용.
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
  x1: z.number().describe('Start X coordinate in points.'),
  y1: z.number().describe('Start Y coordinate in points.'),
  x2: z.number().describe('End X coordinate in points.'),
  y2: z.number().describe('End Y coordinate in points.'),
  duration: z
    .number()
    .optional()
    .default(0.3)
    .describe('Duration in seconds (default 0.3 = 300ms). Longer = slower swipe.'),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbSwipe(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_swipe',
    {
      description:
        'Swipe from (x1,y1) to (x2,y2) on iOS simulator via idb. Coordinates in points. Use for drawer open/close, pager swipe, bottom sheet drag, and other native gestures that cannot be triggered via JS. Get coordinates via evaluate_script with measureView(testID). Verify result with assert_text instead of take_screenshot to save tokens.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { x1, y1, x2, y2, duration, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        const cmd = ['ui', 'swipe', String(x1), String(y1), String(x2), String(y2)];
        if (duration !== 0.3) cmd.push('--duration', String(duration));
        await runIdbCommand(cmd, targetUdid);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) in ${duration}s on simulator ${targetUdid}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_swipe failed: ${message}` }],
        };
      }
    }
  );
}
