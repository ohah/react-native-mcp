/**
 * MCP 도구: input_key
 * iOS(idb HID) / Android(adb keyevent) 키코드 전송 통합.
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
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  keycode: z
    .number()
    .describe(
      'Keycode to send. iOS (HID): 40=Return, 42=Backspace, 43=Tab, 44=Space, 41=Escape. Android: 3=HOME, 4=BACK, 24=VOLUME_UP, 25=VOLUME_DOWN, 26=POWER, 66=ENTER, 67=DEL, 82=MENU, 187=APP_SWITCH.'
    ),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected. Use list_devices to find IDs.'
    ),
});

export function registerInputKey(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'input_key',
    {
      description:
        'Send keycode to iOS simulator (HID keycode via idb) or Android device (Android keycode via adb). iOS (HID): 40=Return, 42=Backspace, 43=Tab, 44=Space, 41=Escape. Android: 3=HOME, 4=BACK, 24=VOLUME_UP, 25=VOLUME_DOWN, 26=POWER, 66=ENTER, 67=DEL, 82=MENU, 187=APP_SWITCH.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, keycode, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runIdbCommand(['ui', 'key', String(keycode)], udid);
          return {
            content: [
              { type: 'text' as const, text: `Sent keycode ${keycode} on iOS simulator ${udid}.` },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await runAdbCommand(['shell', 'input', 'keyevent', String(keycode)], serial);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Sent keycode ${keycode} on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `input_key failed: ${message}` }],
        };
      }
    }
  );
}
