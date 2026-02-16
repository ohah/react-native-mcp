/**
 * MCP 도구: tap
 * iOS(idb) / Android(adb) 좌표 탭 통합.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
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
  getAndroidScale,
} from './adb-utils.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  x: z.number().describe('X coordinate in points (dp). Auto-converted to pixels on Android.'),
  y: z.number().describe('Y coordinate in points (dp). Auto-converted to pixels on Android.'),
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

export function registerTap(server: McpServer, appSession: AppSession): void {
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
        'Tap at (x, y) coordinates on iOS simulator or Android device. Supports long press via duration parameter. Coordinates are always in points (dp) — Android pixels are auto-calculated. Workflow: query_selector → evaluate_script(measureView(uid)) → tap. Verify with assert_text.',
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
          const scale =
            appSession.getPixelRatio(undefined, 'android') ?? (await getAndroidScale(serial));
          const px = Math.round(x * scale);
          const py = Math.round(y * scale);
          if (isLongPress) {
            // Long press = swipe from same point to same point with duration
            await runAdbCommand(
              [
                'shell',
                'input',
                'swipe',
                String(px),
                String(py),
                String(px),
                String(py),
                String(duration),
              ],
              serial
            );
          } else {
            await runAdbCommand(['shell', 'input', 'tap', String(px), String(py)], serial);
          }
          return {
            content: [
              {
                type: 'text' as const,
                text: `${action} at dp(${x}, ${y}) → px(${px}, ${py}) [scale=${scale}]${isLongPress ? ` for ${duration}ms` : ''} on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `tap failed: ${message}` }],
        };
      }
    }
  );
}
