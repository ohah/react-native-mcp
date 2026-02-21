/**
 * MCP 도구: assert_state
 * 셀렉터로 찾은 컴포넌트의 React state Hook 값이 기대값과 일치하는지 검증.
 * inspect_state와 동일한 eval(inspectState) 사용.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  selector: z.string().describe('Selector for component (e.g. #cart-view, CartScreen).'),
  hookIndex: z.number().int().min(0).default(0).describe('Zero-based hook index. Default 0.'),
  path: z
    .string()
    .optional()
    .describe(
      'Dot-notation path into hook value (e.g. "items.length"). Omit to compare whole value.'
    ),
  expected: z
    .union([z.number(), z.string(), z.boolean(), z.record(z.unknown()), z.array(z.unknown())])
    .describe('Expected value. Number, string, boolean, or JSON object/array.'),
  deviceId: deviceParam,
  platform: platformParam,
});

function getAtPath(obj: unknown, path: string): unknown {
  if (!path || path === '.') return obj;
  return path.split('.').reduce((o: unknown, key) => {
    if (o == null) return undefined;
    const v = (o as Record<string, unknown>)[key];
    return v;
  }, obj);
}

function valuesEqual(actual: unknown, expected: unknown): boolean {
  if (actual === expected) return true;
  if (typeof actual !== typeof expected) return false;
  if (typeof actual === 'object' && actual !== null && expected !== null) {
    try {
      return JSON.stringify(actual) === JSON.stringify(expected);
    } catch {
      return false;
    }
  }
  return false;
}

type ServerWithRegisterTool = {
  registerTool(
    name: string,
    def: { description: string; inputSchema: z.ZodTypeAny },
    handler: (args: unknown) => Promise<unknown>
  ): void;
};

export function registerAssertState(server: McpServer, appSession: AppSession): void {
  const s = server as unknown as ServerWithRegisterTool;

  s.registerTool(
    'assert_state',
    {
      description:
        'Assert that a React component state hook value matches expected. Uses selector, hookIndex, optional path (dot-notation), and expected value. Returns { pass, message }.',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const parsed = schema.safeParse(args ?? {});
      if (!parsed.success) {
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `Invalid arguments: ${parsed.error.message}` }],
        };
      }
      const { selector, hookIndex, path, expected, deviceId, platform } = parsed.data;

      if (!appSession.isConnected(deviceId, platform)) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                pass: false,
                message:
                  'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
              }),
            },
          ],
        };
      }

      const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.inspectState ? __REACT_NATIVE_MCP__.inspectState(${JSON.stringify(selector)}) : null; })();`;

      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          10000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({ pass: false, message: `Error: ${res.error}` }),
              },
            ],
          };
        }
        const result = res.result as {
          component?: string;
          hooks?: Array<{ index: number; type: string; value: unknown }>;
        } | null;
        if (!result || !Array.isArray(result.hooks)) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  pass: false,
                  message: `No component or hooks found for selector: ${selector}`,
                }),
              },
            ],
          };
        }
        const hook = result.hooks[hookIndex];
        if (!hook) {
          return {
            content: [
              {
                type: 'text' as const,
                text: JSON.stringify({
                  pass: false,
                  message: `Hook index ${hookIndex} not found. Component "${result.component ?? '?'}" has ${result.hooks.length} hook(s).`,
                }),
              },
            ],
          };
        }
        const actual = getAtPath(hook.value, path ?? '');
        const pass = valuesEqual(actual, expected);
        const pathStr = path ? `.${path}` : '';
        const message = pass
          ? `PASS: ${result.component ?? 'Component'}[${hookIndex}]${pathStr} === ${JSON.stringify(expected)}`
          : `FAIL: ${result.component ?? 'Component'}[${hookIndex}]${pathStr} got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`;
        return {
          content: [{ type: 'text' as const, text: JSON.stringify({ pass, message }) }],
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ pass: false, message: `assert_state failed: ${msg}` }),
            },
          ],
        };
      }
    }
  );
}
