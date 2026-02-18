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
import { getIOSOrientationInfo, transformForIdb } from './ios-landscape.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('ios or android.'),
  x: z.number().describe('X in points (dp). Pixels auto on Android.'),
  y: z.number().describe('Y in points (dp). Pixels auto on Android.'),
  duration: z.number().optional().describe('Hold ms for long press. Omit for tap.'),
  deviceId: z.string().optional().describe('Device ID. Auto if single. list_devices to find.'),
  iosOrientation: z
    .number()
    .optional()
    .describe('iOS orientation 1-4. Portrait=1,2; Landscape=3,4. Skips auto-detect.'),
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
        'Tap at (x,y) in points. Long press via duration (ms). Use after query_selector; verify with assert_text.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, x, y, duration, deviceId, iosOrientation } = schema.parse(args);
      const isLongPress = duration != null && duration > 0;
      const action = isLongPress ? 'Long-pressed' : 'Tapped';

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const info = await getIOSOrientationInfo(
            appSession,
            deviceId,
            platform,
            udid,
            iosOrientation
          );
          const t = transformForIdb(x, y, info);
          const ix = Math.round(t.x);
          const iy = Math.round(t.y);
          const cmd = ['ui', 'tap', String(ix), String(iy)];
          if (isLongPress) cmd.push('--duration', String(duration / 1000));
          await runIdbCommand(cmd, udid);
          // Allow UI to update before returning so callers (e.g. assert_text) see the result.
          await new Promise((r) => setTimeout(r, 300));
          return {
            content: [
              {
                type: 'text' as const,
                text: `${action} at (${ix}, ${iy})${isLongPress ? ` for ${duration}ms` : ''} on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const scale =
            appSession.getPixelRatio(undefined, 'android') ?? (await getAndroidScale(serial));
          const topInsetDp = appSession.getTopInsetDp(deviceId, 'android');
          const px = Math.round(x * scale);
          const py = Math.round((y + topInsetDp) * scale);
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
          // Allow UI to update before returning so callers (e.g. assert_text) see the result.
          await new Promise((r) => setTimeout(r, 300));
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
