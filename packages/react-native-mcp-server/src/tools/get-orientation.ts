/**
 * MCP 도구: get_orientation
 * iOS(backboardd GraphicsOrientation 1–4) / Android(user_rotation 0–3) 현재 방향 조회.
 * 앱 연결 불필요.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { runCommand } from './run-command.js';
import { checkIdbAvailable, resolveUdid, idbNotInstalledError } from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

/** 1,2 = portrait, 3,4 = landscape */
function iosRawToOrientation(raw: number): 'portrait' | 'landscape' {
  return raw === 3 || raw === 4 ? 'landscape' : 'portrait';
}

/** 0,2 = portrait, 1,3 = landscape */
function androidRawToOrientation(raw: number): 'portrait' | 'landscape' {
  return raw === 1 || raw === 3 ? 'landscape' : 'portrait';
}

export function registerGetOrientation(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'get_orientation',
    {
      description:
        'Get current orientation (portrait/landscape). Works without app connection. Returns human-readable and raw platform value.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const buf = await runCommand(
            'xcrun',
            ['simctl', 'spawn', udid, 'defaults', 'read', 'com.apple.backboardd'],
            { timeoutMs: 5000 }
          );
          const stdout = buf.toString('utf8').trim();
          const match = stdout.match(/GraphicsOrientation\s*=\s*(\d+)/);
          const raw = match?.[1] ? parseInt(match[1], 10) : 1;
          const orientation = iosRawToOrientation(raw);
          const result = { orientation, raw };
          const summary = `Orientation on iOS simulator ${udid}: ${orientation} (raw GraphicsOrientation=${raw}).`;
          return {
            content: [
              { type: 'text' as const, text: summary },
              { type: 'text' as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const out = await runAdbCommand(
            ['shell', 'settings', 'get', 'system', 'user_rotation'],
            serial,
            { timeoutMs: 5000 }
          );
          const raw = parseInt(out.trim(), 10);
          const safeRaw = Number.isNaN(raw) ? 0 : Math.max(0, Math.min(3, raw));
          const orientation = androidRawToOrientation(safeRaw);
          const result = { orientation, raw: safeRaw };
          const summary = `Orientation on Android device ${serial}: ${orientation} (raw user_rotation=${safeRaw}).`;
          return {
            content: [
              { type: 'text' as const, text: summary },
              { type: 'text' as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `get_orientation failed: ${message}` }],
        };
      }
    }
  );
}
