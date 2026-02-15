/**
 * MCP 도구: idb_file_push
 * idb file push — iOS 시뮬레이터 앱 컨테이너에 파일 전송.
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
  localPath: z.string().describe('Absolute path to the local file to push.'),
  remotePath: z.string().describe('Destination path inside the app container on the simulator.'),
  bundleId: z.string().describe('Bundle ID of the target app (e.g. com.example.myapp).'),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbFilePush(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_file_push',
    {
      description:
        "Push a local file to an app's container on iOS simulator via idb. Requires bundle ID of the target app.",
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { localPath, remotePath, bundleId, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        await runIdbCommand(['file', 'push', localPath, remotePath, bundleId], targetUdid, {
          timeoutMs: 30000,
        });
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pushed ${localPath} → ${remotePath} (bundle: ${bundleId}) on simulator ${targetUdid}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_file_push failed: ${message}` }],
        };
      }
    }
  );
}
