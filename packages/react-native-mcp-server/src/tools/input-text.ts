/**
 * MCP 도구: input_text
 * iOS(idb) / Android(adb) 현재 포커스된 입력에 텍스트 입력 통합.
 * ASCII만 지원. 한글/유니코드는 type_text(RN 레벨) 사용 권장.
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

/** adb shell input text에서 특수문자 이스케이프 */
function escapeAdbText(text: string): string {
  return text.replace(/([\\"'`\s&|;()<>$!#*?{}[\]~^])/g, '\\$1');
}

const schema = z.object({
  platform: z.enum(['ios', 'android']).describe('Target platform.'),
  text: z.string().describe('Text to type. ASCII only. Use type_text for Unicode.'),
  deviceId: z.string().optional().describe('Device ID. Auto if single. list_devices to find.'),
});

export function registerInputText(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'input_text',
    {
      description: 'Type into focused input. ASCII only. Use type_text for Korean/Unicode.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { platform, text, deviceId } = schema.parse(args);

      try {
        if (platform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          await runIdbCommand(['ui', 'text', text], udid);
          return {
            content: [{ type: 'text' as const, text: `Typed "${text}" on iOS simulator ${udid}.` }],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          const escaped = escapeAdbText(text);
          await runAdbCommand(['shell', 'input', 'text', escaped], serial);
          return {
            content: [
              { type: 'text' as const, text: `Typed "${text}" on Android device ${serial}.` },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `input_text failed: ${message}` }],
        };
      }
    }
  );
}
