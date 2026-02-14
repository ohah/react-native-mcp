/**
 * MCP 도구: assert_text, assert_visible
 * 테스트 러너용 assertion. 내부적으로 querySelector 사용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';
import { buildQuerySelectorEvalCode } from './query-selector.js';

const assertTextSchema = z.object({
  text: z.string().describe('Text substring to assert exists on screen'),
  selector: z
    .string()
    .optional()
    .describe(
      'Optional selector to narrow search scope. If provided, checks text within matching elements only.'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

const assertVisibleSchema = z.object({
  selector: z.string().describe('Selector to check visibility. Uses querySelector syntax.'),
  deviceId: deviceParam,
  platform: platformParam,
});

function registerTool(
  server: McpServer,
  name: string,
  description: string,
  inputSchema: z.ZodTypeAny,
  handler: (args: unknown) => Promise<unknown>
) {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(name, { description, inputSchema }, handler);
}

export function registerAssert(server: McpServer, appSession: AppSession): void {
  // assert_text
  registerTool(
    server,
    'assert_text',
    'Assert that a text substring exists on screen. Returns { pass: boolean, message: string }. Optionally narrow scope with a selector.',
    assertTextSchema,
    async (args: unknown) => {
      const { text, selector, deviceId, platform } = assertTextSchema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected.',
            },
          ],
        };
      }

      // selector가 있으면 해당 요소 내에서 텍스트 검색, 없으면 전체 화면에서 검색
      const selectorStr = selector
        ? `${selector}:text(${JSON.stringify(text)})`
        : `:text(${JSON.stringify(text)})`;
      const code = buildQuerySelectorEvalCode(selectorStr);

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
        const pass = res.result != null;
        const message = pass ? `PASS: text "${text}" found` : `FAIL: text "${text}" not found`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ pass, message }) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `assert_text failed: ${message}` }],
        };
      }
    }
  );

  // assert_visible
  registerTool(
    server,
    'assert_visible',
    'Assert that an element matching the selector is visible (exists in Fiber tree). Returns { pass: boolean, message: string }.',
    assertVisibleSchema,
    async (args: unknown) => {
      const { selector, deviceId, platform } = assertVisibleSchema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected.',
            },
          ],
        };
      }

      const code = buildQuerySelectorEvalCode(selector);
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
        const pass = res.result != null;
        const message = pass
          ? `PASS: element matching "${selector}" found`
          : `FAIL: element matching "${selector}" not found`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ pass, message }) }],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `assert_visible failed: ${message}` }],
        };
      }
    }
  );
}
