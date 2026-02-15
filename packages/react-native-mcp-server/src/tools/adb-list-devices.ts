/**
 * MCP 도구: adb_list_devices
 * 연결된 Android 디바이스/에뮬레이터 목록 조회. 시리얼 확인용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkAdbAvailable, listAdbDevices, adbNotInstalledError } from './adb-utils.js';

const schema = z.object({});

export function registerAdbListDevices(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_list_devices',
    {
      description:
        'List connected Android devices and emulators via adb. Returns serial, state (device/offline/unauthorized), model. Use to discover device serials for other adb tools.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      schema.parse(args ?? {});

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const devices = await listAdbDevices();
        const online = devices.filter((d) => d.state === 'device');
        const summary = [
          `Found ${devices.length} device(s), ${online.length} online.`,
          '',
          ...devices.map(
            (d) =>
              `${d.state === 'device' ? '● ' : '○ '}${d.serial} | ${d.state}${d.model ? ` | ${d.model}` : ''}${d.product ? ` | ${d.product}` : ''}`
          ),
        ].join('\n');

        return {
          content: [
            { type: 'text' as const, text: summary },
            { type: 'text' as const, text: JSON.stringify(devices, null, 2) },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_list_devices failed: ${message}` }],
        };
      }
    }
  );
}
