/**
 * MCP 도구: adb_tap
 * adb shell input tap — Android 디바이스에 좌표 탭 주입.
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
  x: z
    .number()
    .describe(
      'X coordinate in pixels. measureView returns dp; convert: dp × (density / 160). Get density via `adb shell wm density`.'
    ),
  y: z.number().describe('Y coordinate in pixels. Same dp-to-pixel conversion as x.'),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbTap(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_tap',
    {
      description:
        'Tap at (x, y) coordinates on Android device via adb. Coordinates are in pixels. Use evaluate_script with measureView(testID) to get element coordinates first. If testID is unknown, use query_selector to find the element first. After tapping, verify with assert_text instead of take_screenshot to save tokens.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { x, y, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);
        await runAdbCommand(['shell', 'input', 'tap', String(x), String(y)], targetSerial);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Tapped at (${x}, ${y}) on device ${targetSerial}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_tap failed: ${message}` }],
        };
      }
    }
  );
}
