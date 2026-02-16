/**
 * MCP 도구: type_text
 * TextInput에 텍스트 입력. onChangeText 호출 + setNativeProps로 네이티브 값 동기화.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  uid: z
    .string()
    .describe(
      'testID or path of the TextInput. Get from query_selector first — uids are not known in advance.'
    ),
  text: z.string().describe('Text to type into the TextInput'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerTypeText(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'type_text',
    {
      description:
        'Type text into a TextInput identified by uid. Get uid from query_selector first (uids are not known in advance). Calls onChangeText and setNativeProps. Supports Unicode/Korean — use this instead of input_text for non-ASCII.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { uid, text: inputText, deviceId, platform } = schema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
            },
          ],
        };
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.typeText ? __REACT_NATIVE_MCP__.typeText(${JSON.stringify(uid)}, ${JSON.stringify(inputText)}) : { ok: false, error: 'typeText not available' }; })();`;
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          10000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return { content: [{ type: 'text' as const, text: `Error: ${res.error}` }] };
        }
        const out = res.result as { ok?: boolean; error?: string } | undefined;
        const ok = out && typeof out.ok === 'boolean' ? out.ok : false;
        const text = ok
          ? `typed "${inputText}" into ${uid}`
          : out && out.error
            ? out.error
            : 'typeText failed';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `type_text failed: ${message}` }],
        };
      }
    }
  );
}
