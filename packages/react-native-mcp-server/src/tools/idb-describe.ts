/**
 * MCP 도구: idb_describe
 * idb ui describe-all / describe-point — iOS 시뮬레이터 접근성 트리 조회.
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
  mode: z
    .enum(['all', 'point'])
    .optional()
    .default('all')
    .describe(
      '"all" for full accessibility tree (WebView contents not shown), "point" for element at specific coordinates (can see inside WebView).'
    ),
  x: z.number().optional().describe('X coordinate in points (required when mode is "point").'),
  y: z.number().optional().describe('Y coordinate in points (required when mode is "point").'),
  nested: z
    .boolean()
    .optional()
    .default(false)
    .describe('Show hierarchical tree structure instead of flat list.'),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbDescribe(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_describe',
    {
      description:
        'Query iOS simulator accessibility tree via idb. "all" mode returns full tree (WebView contents hidden). "point" mode returns element at coordinates (can see inside WebView). WARNING: "all" mode returns large payload (high token cost). For React Native elements, prefer evaluate_script with measureView(testID). Use idb_describe only for native-only elements (system dialogs, keyboard) or WebView internals.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { mode, x, y, nested, udid } = schema.parse(args);

      if (mode === 'point' && (x == null || y == null)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'x and y coordinates are required when mode is "point".',
            },
          ],
        };
      }

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        const cmd: string[] = [];

        if (mode === 'point') {
          cmd.push('ui', 'describe-point', String(x), String(y));
        } else {
          cmd.push('ui', 'describe-all');
        }
        if (nested) cmd.push('--nested');
        cmd.push('--json');

        const output = await runIdbCommand(cmd, targetUdid, { timeoutMs: 15000 });
        return {
          content: [{ type: 'text' as const, text: output }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_describe failed: ${message}` }],
        };
      }
    }
  );
}
