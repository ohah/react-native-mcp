/**
 * MCP 도구: idb_add_media
 * idb add-media — iOS 시뮬레이터 사진 라이브러리에 미디어 파일 추가.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkIdbAvailable,
  resolveUdid,
  runIdbCommand,
  idbNotInstalledError,
} from './idb-utils.js';

const schema = z.object({
  filePaths: z
    .array(z.string())
    .min(1)
    .describe('Absolute paths to media files (images, videos) to add to the photo library.'),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbAddMedia(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_add_media',
    {
      description:
        'Add media files (images, videos) to iOS simulator photo library via idb. Files appear in the Photos app.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { filePaths, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        await runIdbCommand(['add-media', ...filePaths], targetUdid, { timeoutMs: 30000 });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Added ${filePaths.length} media file(s) to simulator ${targetUdid} photo library.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_add_media failed: ${message}` }],
        };
      }
    }
  );
}
