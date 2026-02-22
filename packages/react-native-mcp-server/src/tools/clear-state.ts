/**
 * MCP 도구: clear_state
 * 앱 데이터/권한 초기화. Android: pm clear. iOS: simctl privacy reset (권한만).
 *
 * 플랫폼별 차이:
 * - Android: adb shell pm clear <package> — 앱 데이터 전부 삭제(AsyncStorage, SharedPreferences 등).
 * - iOS: xcrun simctl privacy <udid> reset all <bundleId> — 권한/프라이버시 리셋만.
 *   앱 샌드박스(문서/캐시)는 삭제되지 않음. 완전 초기화는 앱 삭제 후 재설치 필요.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommand } from './run-command.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';
import { checkIdbAvailable, resolveUdid, idbNotInstalledError } from './idb-utils.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  appId: z.string().describe('Bundle ID (iOS) or package name (Android).'),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

export function registerClearState(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'clear_state',
    {
      description:
        'Clear app data (Android) or reset permissions (iOS). iOS full reset needs uninstall+reinstall.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, appId, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runCommand('xcrun', ['simctl', 'privacy', udid, 'reset', 'all', appId], {
            timeoutMs: 15000,
          });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Reset permissions for ${appId} on iOS simulator ${udid}. (Note: iOS only resets privacy permissions; app sandbox/data is not cleared. For full reset, uninstall and reinstall the app.)`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await runAdbCommand(['shell', 'pm', 'clear', appId], serial, { timeoutMs: 15000 });
          return {
            content: [
              {
                type: 'text' as const,
                text: `Cleared all app data for ${appId} on Android device ${serial}.`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `clear_state failed: ${message}` }],
        };
      }
    }
  );
}
