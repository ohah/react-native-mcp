/**
 * MCP 도구: tap
 * iOS(idb) / Android(adb) 좌표 탭 통합.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkIdbAvailable,
  resolveUdid,
  runIdbCommand,
  idbNotInstalledError,
} from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('ios: idb (points). android: adb (pixels).'),
  x: z.number().describe('X coordinate. iOS: points. Android: pixels (dp × density/160).'),
  y: z.number().describe('Y coordinate. iOS: points. Android: pixels (dp × density/160).'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected. Use list_devices to find IDs.'
    ),
});

export function registerTap(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'tap',
    {
      description:
        'Tap at (x, y) coordinates on iOS simulator or Android device. iOS: coordinates in points (idb). Android: coordinates in pixels (adb). Use evaluate_script with measureView(testID) to get element coordinates first. If testID is unknown, use query_selector to find it. After tapping, verify with assert_text instead of take_screenshot to save tokens.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, x, y, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runIdbCommand(['ui', 'tap', String(x), String(y)], udid);
          return {
            content: [
              { type: 'text' as const, text: `Tapped at (${x}, ${y}) on iOS simulator ${udid}.` },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await runAdbCommand(['shell', 'input', 'tap', String(x), String(y)], serial);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Tapped at (${x}, ${y}) on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `tap failed: ${message}` }],
        };
      }
    }
  );
}
