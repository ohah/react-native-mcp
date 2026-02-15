/**
 * MCP 도구: idb_button
 * idb ui button — iOS 시뮬레이터 물리 버튼 (HOME, LOCK 등) 전송.
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
  button: z
    .enum(['HOME', 'LOCK', 'SIDE_BUTTON', 'SIRI', 'APPLE_PAY'])
    .describe('Physical button to press.'),
  duration: z.number().optional().describe('Hold duration in seconds.'),
  udid: z
    .string()
    .optional()
    .describe(
      'Simulator UDID. Auto-resolved if only one simulator is booted. Use idb_list_targets to find UDIDs.'
    ),
});

export function registerIdbButton(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'idb_button',
    {
      description:
        'Press a physical button (HOME, LOCK, SIDE_BUTTON, SIRI, APPLE_PAY) on iOS simulator via idb.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { button, duration, udid } = schema.parse(args);

      if (!(await checkIdbAvailable())) return idbNotInstalledError();

      try {
        const targetUdid = await resolveUdid(udid);
        const cmd = ['ui', 'button', button];
        if (duration != null) cmd.push('--duration', String(duration));
        await runIdbCommand(cmd, targetUdid);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Pressed ${button}${duration != null ? ` for ${duration}s` : ''} on simulator ${targetUdid}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `idb_button failed: ${message}` }],
        };
      }
    }
  );
}
