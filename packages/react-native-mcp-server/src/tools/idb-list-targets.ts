/**
 * MCP 도구: idb_list_targets
 * 연결된 iOS 시뮬레이터/디바이스 목록 조회. UDID 확인용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkIdbAvailable, listIdbTargets, idbNotInstalledError } from './idb-utils.js';

const schema = z.object({});

export function registerIdbListTargets(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_list_targets',
    {
      description:
        'List connected iOS simulators and devices via idb. Returns name, UDID, state (Booted/Shutdown), OS version. Use to discover simulator UDIDs for other idb tools.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args ?? {});

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targets = await listIdbTargets();
        const booted = targets.filter((t) => t.state === 'Booted');
        const summary = [
          `Found ${targets.length} target(s), ${booted.length} booted.`,
          '',
          ...targets.map(
            (t) =>
              `${t.state === 'Booted' ? '● ' : '○ '}${t.name} | ${t.udid} | ${t.state} | ${t.type} | ${t.os_version}`
          ),
        ].join('\n');

        return {
          content: [
            { type: 'text' as const, text: summary },
            { type: 'text' as const, text: JSON.stringify(targets, null, 2) },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_list_targets failed: ${message}` }],
        };
      }
    }
  );
}
