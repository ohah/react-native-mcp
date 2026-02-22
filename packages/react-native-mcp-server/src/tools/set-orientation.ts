/**
 * MCP 도구: set_orientation
 * Android: settings put system user_rotation. iOS: simulator only, AppleScript Rotate.
 * iOS 실기기 호출 시 명시적 에러.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommand } from './run-command.js';
import {
  checkIdbAvailable,
  resolveUdid,
  listIdbTargets,
  idbNotInstalledError,
} from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const SET_ORIENTATION_TIMEOUT_MS = 15000;

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  orientation: z
    .enum(['portrait', 'landscape'])
    .describe('Desired orientation. Android: 0 or 1. iOS: one rotation toggles.'),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

/** iOS: read current GraphicsOrientation (1–4) via simctl spawn defaults read backboardd */
async function getIosOrientationRaw(udid: string): Promise<number> {
  const buf = await runCommand(
    'xcrun',
    ['simctl', 'spawn', udid, 'defaults', 'read', 'com.apple.backboardd'],
    { timeoutMs: 5000 }
  );
  const match = buf
    .toString('utf8')
    .trim()
    .match(/GraphicsOrientation\s*=\s*(\d+)/);
  return match?.[1] ? parseInt(match[1], 10) : 1;
}

/** 1,2 = portrait, 3,4 = landscape */
function isIosLandscape(raw: number): boolean {
  return raw === 3 || raw === 4;
}

export function registerSetOrientation(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'set_orientation',
    {
      description:
        'Set orientation to portrait or landscape. Android: device/emulator. iOS: simulator only; fails on physical device.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, orientation, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const targets = await listIdbTargets();
          const target = targets.find((t) => t.udid === udid);
          if (!target || target.type !== 'simulator') {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: 'set_orientation on iOS is supported only on simulator. Use an iOS simulator or use Android for physical device.',
                },
              ],
            };
          }
          const currentRaw = await getIosOrientationRaw(udid);
          const wantLandscape = orientation === 'landscape';
          const currentLandscape = isIosLandscape(currentRaw);
          if (wantLandscape === currentLandscape) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `iOS simulator ${udid} is already ${orientation}.`,
                },
              ],
            };
          }
          const script = [
            'tell application "Simulator" to activate',
            'delay 0.3',
            'tell application "System Events"',
            '  tell process "Simulator"',
            '    click menu item "Rotate Right" of menu "Device" of menu bar 1',
            '  end tell',
            'end tell',
          ].join('\n');
          await runCommand('osascript', ['-e', script], { timeoutMs: SET_ORIENTATION_TIMEOUT_MS });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Set orientation to ${orientation} on iOS simulator ${udid} (rotated once).`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const out = await runAdbCommand(
            ['shell', 'settings', 'get', 'system', 'user_rotation'],
            serial,
            { timeoutMs: 5000 }
          );
          const currentRaw = parseInt(out.trim(), 10);
          const currentIsLandscape = currentRaw === 1 || currentRaw === 3;
          const wantLandscape = orientation === 'landscape';
          if (wantLandscape === currentIsLandscape) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Android device ${serial} is already ${orientation}.`,
                },
              ],
            };
          }
          await runAdbCommand(
            ['shell', 'settings', 'put', 'system', 'accelerometer_rotation', '0'],
            serial,
            { timeoutMs: 5000 }
          );
          const userRotation = wantLandscape ? 1 : 0;
          await runAdbCommand(
            ['shell', 'settings', 'put', 'system', 'user_rotation', String(userRotation)],
            serial,
            { timeoutMs: 5000 }
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: `Set orientation to ${orientation} on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `set_orientation failed: ${message}` }],
        };
      }
    }
  );
}
