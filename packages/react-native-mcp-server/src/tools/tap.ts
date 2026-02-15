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
  x: z.number().describe('X coordinate. iOS: points. Android: pixels.'),
  y: z.number().describe('Y coordinate. iOS: points. Android: pixels.'),
  duration: z
    .number()
    .optional()
    .describe('Hold duration in milliseconds for long press. Omit for normal tap.'),
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
        'Tap at (x, y) coordinates on iOS simulator or Android device. Supports long press via duration parameter. iOS: coordinates in points (idb). Android: coordinates in pixels (adb). Workflow: query_selector → evaluate_script(measureView(uid)) → tap. Verify with assert_text.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, x, y, duration, deviceId } = schema.parse(args);
      const isLongPress = duration != null && duration > 0;
      const action = isLongPress ? 'Long-pressed' : 'Tapped';

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const cmd = ['ui', 'tap', String(x), String(y)];
          if (isLongPress) cmd.push('--duration', String(duration / 1000));
          await runIdbCommand(cmd, udid);
          return {
            content: [
              {
                type: 'text' as const,
                text: `${action} at (${x}, ${y})${isLongPress ? ` for ${duration}ms` : ''} on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          if (isLongPress) {
            // Long press = swipe from same point to same point with duration
            await runAdbCommand(
              [
                'shell',
                'input',
                'swipe',
                String(x),
                String(y),
                String(x),
                String(y),
                String(duration),
              ],
              serial
            );
          } else {
            await runAdbCommand(['shell', 'input', 'tap', String(x), String(y)], serial);
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: `${action} at (${x}, ${y})${isLongPress ? ` for ${duration}ms` : ''} on Android device ${serial}.`,
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
