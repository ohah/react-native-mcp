/**
 * MCP 도구: terminate_app
 * iOS(simctl terminate) / Android(adb am force-stop) 앱 종료.
 * 앱 연결 불필요. For development and CI only. Avoid terminating system or critical apps.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommand } from './run-command.js';
import { checkIdbAvailable, resolveUdid, idbNotInstalledError } from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const appIdSchema = z
  .string()
  .min(1, 'appId is required')
  .max(256)
  .regex(
    /^[a-zA-Z0-9._-]+$/,
    'appId must contain only letters, digits, dots, underscores, hyphens'
  );

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  appId: appIdSchema.describe(
    'iOS bundle ID or Android package name (e.g. com.example.app). Use list_apps to find IDs.'
  ),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

export function registerTerminateApp(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'terminate_app',
    {
      description: 'Terminate app by bundle ID or package name. No app connection required.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, appId, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runCommand('xcrun', ['simctl', 'terminate', udid, appId], { timeoutMs: 5000 });
          return {
            content: [
              { type: 'text' as const, text: `App ${appId} terminated on iOS simulator ${udid}.` },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await runAdbCommand(['shell', 'am', 'force-stop', appId], serial, { timeoutMs: 5000 });
          return {
            content: [
              {
                type: 'text' as const,
                text: `App ${appId} terminated on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `terminate_app failed: ${message}` }],
        };
      }
    }
  );
}
