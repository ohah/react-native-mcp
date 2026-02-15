/**
 * MCP 도구: adb_button
 * adb shell input keyevent — Android 디바이스 물리/가상 버튼 전송.
 * 이름으로 키코드를 매핑하여 사용성 향상.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const BUTTON_MAP: Record<string, number> = {
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

const buttonNames = Object.keys(BUTTON_MAP) as [string, ...string[]];

const schema = z.object({
  button: z
    .enum(buttonNames)
    .describe(
      'Button name: HOME, BACK, MENU, APP_SWITCH, POWER, VOLUME_UP, VOLUME_DOWN, ENTER, DEL.'
    ),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbButton(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_button',
    {
      description:
        'Press a named button (HOME, BACK, MENU, APP_SWITCH, POWER, VOLUME_UP, VOLUME_DOWN, ENTER, DEL) on Android device via adb. Maps friendly names to Android keycodes.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { button, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      const keycode = BUTTON_MAP[button];
      if (keycode == null) {
        return {
          content: [
            {
              type: 'text' as const,
              text: `Unknown button "${button}". Available: ${buttonNames.join(', ')}`,
            },
          ],
        };
      }

      try {
        const targetSerial = await resolveSerial(serial);
        await runAdbCommand(['shell', 'input', 'keyevent', String(keycode)], targetSerial);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pressed ${button} (keycode ${keycode}) on device ${targetSerial}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_button failed: ${message}` }],
        };
      }
    }
  );
}
