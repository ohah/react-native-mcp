/**
 * MCP 도구: long_press_by_label
 * Fiber 트리에서 라벨(텍스트)에 해당하는 onLongPress 노드를 찾아 호출. testID 없어도 동작.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  label: z
    .string()
    .describe(
      'Label (text) substring to find. Long-presses the element that contains this text (onLongPress).'
    ),
  index: z
    .number()
    .int()
    .min(0)
    .optional()
    .describe(
      '0-based index. When multiple elements match the label, long-press the nth one. Omit for first.'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

export function buildLongPressByLabelEvalCode(label: string, index?: number): string {
  const indexArg = typeof index === 'number' ? `, ${index}` : '';
  return `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.longPressByLabel && __REACT_NATIVE_MCP__.longPressByLabel(${JSON.stringify(label)}${indexArg}); })();`;
}

export function registerLongPressByLabel(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'long_press_by_label',
    {
      description:
        'Find and long-press the element matching the label (text) in the Fiber tree. Use index for nth match (0-based). Works without testID. Requires DevTools hook.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const parsed = schema.parse(args);
      const { label, index, deviceId, platform } = parsed;

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

      const code = buildLongPressByLabelEvalCode(label, index);
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
        const fired = res.result === true;
        const text = fired
          ? typeof index === 'number'
            ? `long-pressed (label "${label}" nth match (index ${index}) onLongPress triggered)`
            : 'long-pressed (onLongPress triggered via Fiber label match)'
          : 'No matching element. Is DevTools hook present? Does an element match the label/index with onLongPress?';
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `long_press_by_label failed: ${message}` }],
        };
      }
    }
  );
}
