/**
 * MCP 도구: swipe
 * iOS(idb) / Android(adb) 스와이프 제스처 통합.
 * duration은 밀리초 단위로 통일 (iOS 내부에서 초로 변환).
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
  x1: z.number().describe('Start X. iOS: points. Android: pixels.'),
  y1: z.number().describe('Start Y. iOS: points. Android: pixels.'),
  x2: z.number().describe('End X. iOS: points. Android: pixels.'),
  y2: z.number().describe('End Y. iOS: points. Android: pixels.'),
  duration: z
    .number()
    .optional()
    .default(300)
    .describe('Duration in milliseconds (default 300). Longer = slower swipe.'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected. Use list_devices to find IDs.'
    ),
});

export function registerSwipe(server: McpServer): void {
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
      description:
        'Swipe from (x1,y1) to (x2,y2) on iOS simulator or Android device. iOS: coordinates in points (idb). Android: coordinates in pixels (adb). Duration in ms (default 300). Use for drawer, pager, bottom sheet, scroll. Workflow: query_selector → evaluate_script(measureView(uid)) → swipe. Verify with assert_text.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, x1, y1, x2, y2, duration, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const durationSec = duration / 1000;
          const cmd = ['ui', 'swipe', String(x1), String(y1), String(x2), String(y2)];
          if (durationSec !== 0.3) cmd.push('--duration', String(durationSec));
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
            serial
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: `Swiped from (${x1}, ${y1}) to (${x2}, ${y2}) in ${duration}ms on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `swipe failed: ${message}` }],
        };
      }
    }
  );
}
