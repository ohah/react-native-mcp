/**
 * MCP 도구: press_button
 * iOS(idb) / Android(adb) 물리 버튼 통합.
 * Android: HOME, BACK, MENU, APP_SWITCH, POWER, VOLUME_UP, VOLUME_DOWN, ENTER, DEL
 * iOS: HOME, LOCK, SIDE_BUTTON, SIRI, APPLE_PAY
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

const ADB_BUTTON_MAP: Record<string, number> = {
  HOME: 3,
  BACK: 4,
  MENU: 82,
  APP_SWITCH: 187,
  POWER: 26,
  VOLUME_UP: 24,
  VOLUME_DOWN: 25,
  ENTER: 66,
  DEL: 67,
};

const IDB_BUTTONS = new Set(['HOME', 'LOCK', 'SIDE_BUTTON', 'SIRI', 'APPLE_PAY']);

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  button: z
    .string()
    .describe(
      'Button name. Android: HOME, BACK, MENU, APP_SWITCH, POWER, VOLUME_UP, VOLUME_DOWN, ENTER, DEL. iOS: HOME, LOCK, SIDE_BUTTON, SIRI, APPLE_PAY.'
    ),
  duration: z
    .number()
    .optional()
    .describe('Hold duration in seconds (iOS only, ignored on Android).'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected. Use list_devices to find IDs.'
    ),
});

export function registerPressButton(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'press_button',
    {
      description:
        'Press a physical button on iOS simulator or Android device. Android: HOME, BACK, MENU, APP_SWITCH, POWER, VOLUME_UP, VOLUME_DOWN, ENTER, DEL. iOS: HOME, LOCK, SIDE_BUTTON, SIRI, APPLE_PAY. Duration (hold) is iOS only.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, button, duration, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!IDB_BUTTONS.has(button)) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Unknown iOS button "${button}". Available: ${[...IDB_BUTTONS].join(', ')}`,
                },
              ],
            };
          }
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const cmd = ['ui', 'button', button];
          if (duration != null) cmd.push('--duration', String(duration));
          await runIdbCommand(cmd, udid);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Pressed ${button}${duration != null ? ` for ${duration}s` : ''} on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          const keycode = ADB_BUTTON_MAP[button];
          if (keycode == null) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: `Unknown Android button "${button}". Available: ${Object.keys(ADB_BUTTON_MAP).join(', ')}`,
                },
              ],
            };
          }
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await runAdbCommand(['shell', 'input', 'keyevent', String(keycode)], serial);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Pressed ${button} (keycode ${keycode}) on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `press_button failed: ${message}` }],
        };
      }
    }
  );
}
