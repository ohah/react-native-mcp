/**
 * MCP 도구: adb_file_push
 * adb push — 로컬 파일을 Android 디바이스로 전송.
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
  localPath: z.string().describe('Absolute path to the local file to push.'),
  remotePath: z
    .string()
    .describe('Destination path on the Android device (e.g. /sdcard/Download/file.txt).'),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbFilePush(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_file_push',
    {
      description:
        'Push a local file to Android device via adb. Specify local path and remote destination path (e.g. /sdcard/Download/file.txt).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { localPath, remotePath, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);
        const output = await runAdbCommand(['push', localPath, remotePath], targetSerial, {
          timeoutMs: 30000,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pushed ${localPath} → ${remotePath} on device ${targetSerial}.\n${output}`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_file_push failed: ${message}` }],
        };
      }
    }
  );
}
