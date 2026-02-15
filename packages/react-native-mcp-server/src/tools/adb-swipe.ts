/**
 * MCP 도구: adb_swipe
 * adb shell input swipe — Android 디바이스에 스와이프 제스처 주입.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const schema = z.object({
  x1: z
    .number()
    .describe(
      'Start X coordinate in pixels. measureView returns dp; convert: dp × (density / 160). Get density via `adb shell wm density`.'
    ),
  y1: z.number().describe('Start Y coordinate in pixels. Same dp-to-pixel conversion as x1.'),
  x2: z.number().describe('End X coordinate in pixels.'),
  y2: z.number().describe('End Y coordinate in pixels.'),
  duration: z
    .number()
    .optional()
    .default(300)
    .describe('Duration in milliseconds (default 300). Longer = slower swipe.'),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbSwipe(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_swipe',
    {
      description:
        'Swipe from (x1,y1) to (x2,y2) on Android device via adb. Coordinates in pixels. Use for drawer open/close, pager swipe, bottom sheet drag, and other native gestures. Get coordinates via evaluate_script with measureView(testID). If testID is unknown, use query_selector first. Duration in milliseconds (default 300).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { x1, y1, x2, y2, duration, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);
        await runAdbCommand(
          [
            'shell',
            'input',
            'swipe',
            String(x1),
            String(y1),
            String(x2),
            String(y2),
            String(duration),
          ],
          targetSerial
        );
        return {
          content: [
            {
              type: 'text' as const,
              text: `Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) in ${duration}ms on device ${targetSerial}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_swipe failed: ${message}` }],
        };
      }
    }
  );
}
