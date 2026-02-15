/**
 * MCP 도구: adb_key
 * adb shell input keyevent — Android 디바이스에 키코드 전송.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const schema = z.object({
  keycode: z
    .number()
    .describe(
      'Android keycode to send. Common: 3=HOME, 4=BACK, 24=VOLUME_UP, 25=VOLUME_DOWN, 26=POWER, 66=ENTER, 67=DEL, 82=MENU, 187=APP_SWITCH.'
    ),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbKey(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_key',
    {
      description:
        'Send Android keycode to device via adb. Common keycodes: 3=HOME, 4=BACK, 24=VOLUME_UP, 25=VOLUME_DOWN, 26=POWER, 66=ENTER, 67=DEL, 82=MENU, 187=APP_SWITCH.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { keycode, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);
        await runAdbCommand(['shell', 'input', 'keyevent', String(keycode)], targetSerial);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Sent keycode ${keycode} on device ${targetSerial}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_key failed: ${message}` }],
        };
      }
    }
  );
}
