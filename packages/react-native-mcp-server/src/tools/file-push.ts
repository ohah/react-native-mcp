/**
 * MCP 도구: file_push
 * iOS(idb file push) / Android(adb push) 파일 전송 통합.
 * iOS는 bundleId 필수 (앱 컨테이너 모델).
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
  localPath: z.string().describe('Absolute path to the local file to push.'),
  remotePath: z
    .string()
    .describe('Destination. iOS: in app container. Android: e.g. /sdcard/Download/file.txt.'),
  bundleId: z.string().optional().describe('Bundle ID. iOS only, required.'),
  deviceId: z.string().optional().describe('Device ID. Auto if single. list_devices to find.'),
});

export function registerFilePush(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'file_push',
    {
      description: 'Push local file to simulator/device. iOS: idb + bundleId. Android: adb path.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, localPath, remotePath, bundleId, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!bundleId) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'bundleId is required for iOS file_push. Specify the target app bundle ID (e.g. com.example.myapp).',
                },
              ],
            };
          }
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runIdbCommand(['file', 'push', localPath, remotePath, bundleId], udid, {
            timeoutMs: 30000,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Pushed ${localPath} → ${remotePath} (bundle: ${bundleId}) on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const output = await runAdbCommand(['push', localPath, remotePath], serial, {
            timeoutMs: 30000,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Pushed ${localPath} → ${remotePath} on Android device ${serial}.\n${output}`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `file_push failed: ${message}` }],
        };
      }
    }
  );
}
