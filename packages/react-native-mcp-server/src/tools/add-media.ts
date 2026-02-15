/**
 * MCP 도구: add_media
 * iOS(idb add-media) / Android(adb push + media scanner) 미디어 추가 통합.
 */

import * as path from 'node:path';
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
  filePaths: z
    .array(z.string())
    .min(1)
    .describe('Absolute paths to media files (images, videos) to add to device gallery.'),
  deviceId: z
    .string()
    .optional()
    .describe(
      'Device identifier. iOS: simulator UDID. Android: device serial. Auto-resolved if only one device is connected. Use list_devices to find IDs.'
    ),
});

export function registerAddMedia(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'add_media',
    {
      description:
        'Add media files (images, videos) to iOS simulator photo library (idb) or Android device gallery (adb push + media scanner).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, filePaths, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runIdbCommand(['add-media', ...filePaths], udid, { timeoutMs: 30000 });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Added ${filePaths.length} media file(s) to iOS simulator ${udid} photo library.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);

          for (const filePath of filePaths) {
            const filename = path.basename(filePath);
            const remotePath = `/sdcard/Download/${filename}`;
            await runAdbCommand(['push', filePath, remotePath], serial, { timeoutMs: 30000 });
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
              serial
            );
          }

          return {
            content: [
              {
                type: 'text' as const,
                text: `Added ${filePaths.length} media file(s) to Android device ${serial} gallery.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `add_media failed: ${message}` }],
        };
      }
    }
  );
}
