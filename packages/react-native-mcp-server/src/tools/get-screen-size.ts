/**
 * MCP 도구: get_screen_size
 * Android: adb wm size. iOS: 앱 연결 시 getScreenInfo(); 없으면 미지원 에러.
 * 단위: px (물리 픽셀).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { checkIdbAvailable, resolveUdid, idbNotInstalledError } from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

const GET_SCREEN_SIZE_TIMEOUT_MS =
  typeof process.env.REACT_NATIVE_MCP_GET_SCREEN_SIZE_TIMEOUT_MS !== 'undefined'
    ? Math.max(5000, parseInt(process.env.REACT_NATIVE_MCP_GET_SCREEN_SIZE_TIMEOUT_MS, 10) || 15000)
    : 15000;

const SCREEN_INFO_CODE =
  '(function(){ var M = typeof __REACT_NATIVE_MCP__ !== "undefined" ? __REACT_NATIVE_MCP__ : null; return M && M.getScreenInfo ? M.getScreenInfo() : null; })();';

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  deviceId: z
    .string()
    .optional()
    .describe('Optional. iOS: UDID. Android: serial. Auto if single device.'),
});

export function registerGetScreenSize(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'get_screen_size',
    {
      description:
        'Return screen size (width/height in px). Android: host-only. iOS: requires app connection for reliable result; otherwise use Android or connect app.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, deviceId } = schema.parse(args);

      try {
        if (platform === 'android') {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const out = await runAdbCommand(['shell', 'wm', 'size'], serial, {
            timeoutMs: GET_SCREEN_SIZE_TIMEOUT_MS,
          });
          const match = out.match(/Physical size:\s*(\d+)x(\d+)/);
          if (!match) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: `get_screen_size failed: Could not parse "wm size" output. Raw: ${out.slice(0, 200)}`,
                },
              ],
            };
          }
          const width = parseInt(match[1], 10);
          const height = parseInt(match[2], 10);
          const result = { width, height, unit: 'px' as const };
          const summary = `Screen size on Android device ${serial}: ${width}x${height} px.`;
          return {
            content: [
              { type: 'text' as const, text: summary },
              { type: 'text' as const, text: JSON.stringify(result, null, 2) },
            ],
          };
        } else {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          if (!appSession.isConnected()) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: 'get_screen_size on iOS without app connection is not supported. Connect the app or use Android.',
                },
              ],
            };
          }
          const devices = appSession.getConnectedDevices();
          const iosDevice = devices.find(
            (d) =>
              d.platform === 'ios' && (!deviceId || d.deviceId === deviceId || d.deviceId === udid)
          );
          if (!iosDevice) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: 'get_screen_size on iOS requires an app connected for this device. Connect the app or use Android.',
                },
              ],
            };
          }
          const res = await appSession.sendRequest(
            { method: 'eval', params: { code: SCREEN_INFO_CODE } },
            GET_SCREEN_SIZE_TIMEOUT_MS,
            iosDevice.deviceId,
            'ios'
          );
          const info = res.result as {
            screen?: { width: number; height: number };
            scale?: number;
          } | null;
          if (!info || typeof info !== 'object' || !info.screen) {
            return {
              isError: true,
              content: [
                {
                  type: 'text' as const,
                  text: 'get_screen_size failed: getScreenInfo() did not return screen dimensions. Ensure the app is connected.',
                },
              ],
            };
          }
          const scale = typeof info.scale === 'number' && info.scale > 0 ? info.scale : 1;
          const width = Math.round(info.screen.width * scale);
          const height = Math.round(info.screen.height * scale);
          const result = { width, height, unit: 'px' as const };
          const summary = `Screen size on iOS simulator ${udid} (from app): ${width}x${height} px.`;
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
          content: [{ type: 'text' as const, text: `get_screen_size failed: ${message}` }],
        };
      }
    }
  );
}
