/**
 * MCP 도구: list_apps
 * iOS(idb list-apps) / Android(adb pm list packages -3) 설치된 앱 목록 조회.
 * 앱 연결 불필요.
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
} from './adb-utils.js';

const LIST_APPS_TIMEOUT_MS =
  typeof process.env.REACT_NATIVE_MCP_LIST_APPS_TIMEOUT_MS !== 'undefined'
    ? Math.max(5000, parseInt(process.env.REACT_NATIVE_MCP_LIST_APPS_TIMEOUT_MS, 10) || 15000)
    : 15000;

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform. list_devices for deviceId.'),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

interface ListAppItem {
  id: string;
  name?: string;
}

export function registerListApps(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'list_apps',
    {
      description:
        'List installed apps on device/simulator (idb/adb). No app connection required. Returns bundle IDs or packages. Use these IDs with terminate_app(platform, appId).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const out = await runIdbCommand(['list-apps', '--json'], udid, {
            timeoutMs: LIST_APPS_TIMEOUT_MS,
          });
          const apps: ListAppItem[] = [];
          for (const line of out.split('\n')) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const row = JSON.parse(trimmed) as { bundle_id?: string; name?: string };
              const id = row.bundle_id ?? '';
              if (id) apps.push({ id, name: row.name });
            } catch {
              // skip malformed lines
            }
          }
          const summary = [
            `Found ${apps.length} app(s) on iOS simulator ${udid}.`,
            'Use these IDs with terminate_app(platform, appId).',
            '',
            ...apps.slice(0, 20).map((a) => `  ${a.id}${a.name ? ` (${a.name})` : ''}`),
            ...(apps.length > 20 ? [`  ... and ${apps.length - 20} more`] : []),
          ].join('\n');
          return {
            content: [
              { type: 'text' as const, text: summary },
              { type: 'text' as const, text: JSON.stringify(apps, null, 2) },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const out = await runAdbCommand(['shell', 'pm', 'list', 'packages', '-3'], serial, {
            timeoutMs: LIST_APPS_TIMEOUT_MS,
          });
          const apps: ListAppItem[] = out
            .split('\n')
            .map((line) => {
              const pkg = line.startsWith('package:') ? line.slice(8).trim() : line.trim();
              return pkg ? { id: pkg } : null;
            })
            .filter((a): a is ListAppItem => a != null && a.id.length > 0);
          const summary = [
            `Found ${apps.length} app(s) on Android device ${serial} (third-party only).`,
            'Use these IDs with terminate_app(platform, appId).',
            '',
            ...apps.slice(0, 20).map((a) => `  ${a.id}`),
            ...(apps.length > 20 ? [`  ... and ${apps.length - 20} more`] : []),
          ].join('\n');
          return {
            content: [
              { type: 'text' as const, text: summary },
              { type: 'text' as const, text: JSON.stringify(apps, null, 2) },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `list_apps failed: ${message}` }],
        };
      }
    }
  );
}
