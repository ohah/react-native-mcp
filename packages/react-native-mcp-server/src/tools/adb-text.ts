/**
 * MCP 도구: adb_text
 * adb shell input text — Android 디바이스에 텍스트 입력.
 * 특수문자는 자동 이스케이프. 한글 등 유니코드는 MCP type_text 사용 권장.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
} from './adb-utils.js';

/** adb shell input text 에서 특수문자 이스케이프 */
function escapeAdbText(text: string): string {
  // Characters that need escaping in adb shell: spaces, quotes, parentheses, &, |, ;, <, >, etc.
  return text.replace(/([\\"'`\s&|;()<>$!#*?{}[\]~^])/g, '\\$1');
}

const schema = z.object({
  text: z
    .string()
    .describe(
      'Text to type into the currently focused input. ASCII only (English/numbers). For Korean/Unicode, use MCP type_text tool instead.'
    ),
  serial: z
    .string()
    .optional()
    .describe(
      'Device serial. Auto-resolved if only one device is connected. Use adb_list_devices to find serials.'
    ),
});

export function registerAdbText(server: McpServer): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'adb_text',
    {
      description:
        'Type text into the currently focused input on Android device via adb. ASCII only (English, numbers, symbols). Special characters are auto-escaped. For Korean/Unicode input, use MCP type_text tool instead.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { text, serial } = schema.parse(args);

      if (!(await checkAdbAvailable())) return adbNotInstalledError();

      try {
        const targetSerial = await resolveSerial(serial);
        const escaped = escapeAdbText(text);
        await runAdbCommand(['shell', 'input', 'text', escaped], targetSerial);
        return {
          content: [
            {
              type: 'text' as const,
              text: `Typed "${text}" on device ${targetSerial}.`,
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `adb_text failed: ${message}` }],
        };
      }
    }
  );
}
