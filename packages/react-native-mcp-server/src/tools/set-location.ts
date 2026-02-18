/**
 * MCP 도구: set_location
 * 시뮬레이터/에뮬레이터에 위도·경도 설정. Android 실기기 미지원.
 *
 * 플랫폼별 차이:
 * - iOS: idb set-location <lat> <lon> — 시뮬레이터 모두 지원.
 * - Android: adb emu geo fix <lon> <lat> — 에뮬레이터 전용. 실기기에서는 동작하지 않음.
 */

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
  isAndroidEmulator,
} from './adb-utils.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  latitude: z.number().min(-90).max(90).describe('Latitude (-90–90).'),
  longitude: z.number().min(-180).max(180).describe('Longitude (-180–180).'),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

export function registerSetLocation(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'set_location',
    {
      description: 'Set GPS on iOS simulator or Android emulator. Android: emulator only.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, latitude, longitude, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runIdbCommand(['set-location', String(latitude), String(longitude)], udid, {
            timeoutMs: 5000,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Set location to ${latitude}, ${longitude} on iOS simulator ${udid}.`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const isEmulator = await isAndroidEmulator(serial);
          if (!isEmulator) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: `set_location on Android is supported only on emulator. Device ${serial} appears to be a physical device (ro.kernel.qemu is not 1). Use an AVD (emulator) for location simulation.`,
                },
              ],
            };
          }
          // adb emu geo fix: longitude first, then latitude. Emulator only.
          await runAdbCommand(['emu', 'geo', 'fix', String(longitude), String(latitude)], serial, {
            timeoutMs: 5000,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Set location to ${latitude}, ${longitude} on Android emulator ${serial}. (Note: set_location on Android works only on emulator, not on physical devices.)`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const hint =
          platform === 'android'
            ? ' set_location on Android is supported only on emulator; use an AVD, not a physical device.'
            : '';
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: `set_location failed: ${message}.${hint}`,
            },
          ],
        };
      }
    }
  );
}
