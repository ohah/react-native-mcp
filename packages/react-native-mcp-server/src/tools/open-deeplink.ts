/**
 * MCP tool: open_deeplink
 * Open a deep link / URL on iOS simulator (xcrun simctl) or Android device (adb).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';
import { checkIdbAvailable, resolveUdid, idbNotInstalledError } from './idb-utils.js';
import { runCommand } from './run-command.js';

const schema = z.object({
  url: z.string().describe('The deep link URL to open (e.g. "myapp://product/123").'),
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected. Use list_devices to find IDs.'
    ),
});

export function registerOpenDeeplink(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'open_deeplink',
    {
      description:
        'Open a deep link / URL on iOS simulator or Android device. Use this to navigate to specific screens via custom URL schemes or universal links.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { url, platform, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runCommand('xcrun', ['simctl', 'openurl', udid, url]);
          return {
            content: [
              {
                type: 'text' as const,
                text: `Opened deep link "${url}" on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await runAdbCommand(
            ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-d', url],
            serial
          );
          return {
            content: [
              {
                type: 'text' as const,
                text: `Opened deep link "${url}" on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `open_deeplink failed: ${message}` }],
        };
      }
    }
  );
}
