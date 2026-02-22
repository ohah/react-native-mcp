/**
 * MCP 도구: swipe
 * iOS(idb) / Android(adb) 스와이프 제스처 통합.
 * duration은 밀리초 단위로 통일 (iOS 내부에서 초로 변환).
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
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  x1: z.number().describe('Start X in points (dp). Auto-converted to pixels on Android.'),
  y1: z.number().describe('Start Y in points (dp). Auto-converted to pixels on Android.'),
  x2: z.number().describe('End X in points (dp). Auto-converted to pixels on Android.'),
  y2: z.number().describe('End Y in points (dp). Auto-converted to pixels on Android.'),
  duration: z.number().optional().default(300).describe('Swipe duration ms. Default 300.'),
  deviceId: z.string().optional().describe('Device ID. Auto if single. list_devices to find.'),
  iosOrientation: z.number().optional().describe('iOS orientation 1-4. Skips auto-detect.'),
});

export function registerSwipe(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'swipe',
    {
      description: 'Swipe from (x1,y1) to (x2,y2) in points. For scrolling and drawers.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, x1, y1, x2, y2, duration, deviceId, iosOrientation } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const durationSec = duration / 1000;
          const info = await getIOSOrientationInfo(
            appSession,
            deviceId,
            platform,
            udid,
            iosOrientation
          );
          const s1 = transformForIdb(x1, y1, info);
          const s2 = transformForIdb(x2, y2, info);
          const ix1 = Math.round(s1.x);
          const iy1 = Math.round(s1.y);
          const ix2 = Math.round(s2.x);
          const iy2 = Math.round(s2.y);
          const cmd = ['ui', 'swipe', String(ix1), String(iy1), String(ix2), String(iy2)];
          cmd.push('--duration', String(durationSec));
          cmd.push('--delta', '10');
          await runIdbCommand(cmd, udid);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) in ${duration}ms on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const scale =
            appSession.getPixelRatio(undefined, 'android') ?? (await getAndroidScale(serial));
          const topInsetDp = appSession.getTopInsetDp(deviceId, 'android');
          const px1 = Math.round(x1 * scale);
          const py1 = Math.round((y1 + topInsetDp) * scale);
          const px2 = Math.round(x2 * scale);
          const py2 = Math.round((y2 + topInsetDp) * scale);
          await runAdbCommand(
            [
              'shell',
              'input',
              'swipe',
              String(px1),
              String(py1),
              String(px2),
              String(py2),
              String(duration),
            ],
            serial
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: `Swiped from dp(${x1}, ${y1}) → px(${px1}, ${py1}) to dp(${x2}, ${y2}) → px(${px2}, ${py2}) [scale=${scale}] in ${duration}ms on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `swipe failed: ${message}` }],
        };
      }
    }
  );
}
