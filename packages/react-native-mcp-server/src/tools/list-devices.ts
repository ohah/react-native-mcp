/**
 * MCP 도구: list_devices
 * iOS(idb list-targets) / Android(adb devices) 디바이스 목록 조회 통합.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkIdbAvailable, listIdbTargets, idbNotInstalledError } from './idb-utils.js';
import {
  checkAdbAvailable,
  listAdbDevices,
  adbNotInstalledError,
  isAndroidEmulator,
} from './adb-utils.js';

const schema = z.object({
  platform: z
    .enum(['ios', 'android'])
    .describe('ios: list iOS simulators via idb. android: list Android devices/emulators via adb.'),
});

export function registerListDevices(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'list_devices',
    {
      description:
        'List connected devices. iOS (idb): returns name, UDID, state (Booted/Shutdown), OS version. Android (adb): returns serial, state, model. Use to discover device IDs for other tools.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
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
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const devices = await listAdbDevices();
          const online = devices.filter((d) => d.state === 'device');
          const withEmulatorFlag = await Promise.all(
            devices.map(async (d) => ({
              ...d,
              isEmulator: d.state === 'device' ? await isAndroidEmulator(d.serial) : undefined,
            }))
          );
          const summary = [
            `Found ${devices.length} device(s), ${online.length} online.`,
            '(emulator = AVD, physical = real device. set_location works only on emulator.)',
            '',
            ...withEmulatorFlag.map(
              (d) =>
                `${d.state === 'device' ? '● ' : '○ '}${d.serial} | ${d.state}${d.isEmulator != null ? ` | ${d.isEmulator ? 'emulator' : 'physical'}` : ''}${d.model ? ` | ${d.model}` : ''}${d.product ? ` | ${d.product}` : ''}`
            ),
          ].join('\n');
          return {
            content: [
              { type: 'text' as const, text: summary },
              { type: 'text' as const, text: JSON.stringify(withEmulatorFlag, null, 2) },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `list_devices failed: ${message}` }],
        };
      }
    }
  );
}
