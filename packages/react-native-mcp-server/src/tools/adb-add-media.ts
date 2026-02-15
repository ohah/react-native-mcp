/**
 * MCP 도구: adb_add_media
 * adb push + media scanner broadcast — 로컬 미디어 파일을 Android 갤러리에 추가.
 */

import * as path from 'node:path';
import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const schema = z.object({
  filePath: z
    .string()
    .describe('Absolute path to the local media file (image, video, audio) to add.'),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbAddMedia(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_add_media',
    {
      description:
        'Add a media file (image, video, audio) to Android device gallery. Pushes the file to /sdcard/Download/ and triggers media scanner so it appears in gallery apps.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { filePath, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);
        const filename = path.basename(filePath);
        const remotePath = `/sdcard/Download/${filename}`;

        // Push file to device
        await runAdbCommand(['push', filePath, remotePath], targetSerial, { timeoutMs: 30000 });

        // Trigger media scanner
        await runAdbCommand(
          [
            'shell',
            'am',
            'broadcast',
            '-a',
            'android.intent.action.MEDIA_SCANNER_SCAN_FILE',
            '-d',
            `file://${remotePath}`,
          ],
          targetSerial
        );

        return {
          content: [
            {
              type: 'text' as const,
              text: `Added media ${filename} to device ${targetSerial}. File at ${remotePath}, media scanner triggered.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_add_media failed: ${message}` }],
        };
      }
    }
  );
}
