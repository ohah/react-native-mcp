/**
 * MCP 도구: assert_text, assert_visible, assert_not_visible, assert_element_count
 * 테스트 러너용 assertion. 내부적으로 querySelector 사용.
 * timeoutMs/intervalMs 파라미터로 polling 지원 (CI 안정성 향상).
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';
import { buildQuerySelectorEvalCode, buildQuerySelectorAllEvalCode } from './query-selector.js';

const timeoutParam = z
  .number()
  .optional()
  .default(0)
  .describe('Max wait time in ms. 0 (default) = single check. >0 = poll until pass or timeout.');
const intervalParam = z
  .number()
  .optional()
  .default(300)
  .describe('Polling interval in ms (default 300). Only used when timeoutMs > 0.');

const assertTextSchema = z.object({
  text: z.string().describe('Text substring to assert exists on screen'),
  selector: z
    .string()
    .optional()
    .describe(
      'Optional selector to narrow search scope. If provided, checks text within matching elements only.'
    ),
  timeoutMs: timeoutParam,
  intervalMs: intervalParam,
  deviceId: deviceParam,
  platform: platformParam,
});

const assertVisibleSchema = z.object({
  selector: z.string().describe('Selector to check visibility. Uses querySelector syntax.'),
  timeoutMs: timeoutParam,
  intervalMs: intervalParam,
  deviceId: deviceParam,
  platform: platformParam,
});

const assertNotVisibleSchema = z.object({
  selector: z
    .string()
    .describe('Selector of element that should NOT be visible (not found in Fiber tree).'),
  timeoutMs: timeoutParam,
  intervalMs: intervalParam,
  deviceId: deviceParam,
  platform: platformParam,
});

const assertElementCountSchema = z.object({
  selector: z.string().describe('Selector to count matching elements.'),
  expectedCount: z
    .number()
    .optional()
    .describe('Exact expected count. Mutually exclusive with minCount/maxCount.'),
  minCount: z.number().optional().describe('Minimum expected count (inclusive).'),
  maxCount: z.number().optional().describe('Maximum expected count (inclusive).'),
  timeoutMs: timeoutParam,
  intervalMs: intervalParam,
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 서버 측 polling 루프. checkFn이 pass:true 반환하거나 timeout 초과까지 반복. */
async function pollUntil(
  checkFn: () => Promise<{ pass: boolean; [key: string]: unknown }>,
  timeoutMs: number,
  intervalMs: number
): Promise<{ pass: boolean; [key: string]: unknown }> {
  const result = await checkFn();
  if (result.pass || timeoutMs <= 0) return result;

  const start = Date.now();
  let lastResult = result;
  while (Date.now() - start < timeoutMs) {
    await sleep(intervalMs);
    lastResult = await checkFn();
    if (lastResult.pass) return lastResult;
  }
  return lastResult;
}

function textContent(data: { type: string; text: string }) {
  return { content: [{ type: 'text' as const, text: data.text }] };
}

function jsonContent(obj: Record<string, unknown>) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(obj) }] };
}

export function registerAssert(server: McpServer, appSession: AppSession): void {
  // ─── assert_text ────────────────────────────────────────────────
  registerTool(
    server,
    'assert_text',
    'Assert that a text substring exists on screen. Returns { pass: boolean, message: string }. Optionally narrow scope with a selector. Supports polling with timeoutMs/intervalMs for CI stability.',
    assertTextSchema,
    async (args: unknown) => {
      const { text, selector, timeoutMs, intervalMs, deviceId, platform } =
        assertTextSchema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return textContent({ type: 'text', text: 'No React Native app connected.' });
      }

      const selectorStr = selector
        ? `${selector}:text(${JSON.stringify(text)})`
        : `:text(${JSON.stringify(text)})`;
      const code = buildQuerySelectorEvalCode(selectorStr);
      const requestTimeout = Math.max(10000, timeoutMs + 5000);

      try {
        const result = await pollUntil(
          async () => {
            const res = await appSession.sendRequest(
              { method: 'eval', params: { code } },
              requestTimeout,
              deviceId,
              platform
            );
            if (res.error != null) return { pass: false, error: res.error };
            const pass = res.result != null;
            return { pass };
          },
          timeoutMs,
          intervalMs
        );

        if (result.error) {
          return textContent({ type: 'text', text: `Error: ${result.error}` });
        }
        const pass = result.pass;
        const message = pass ? `PASS: text "${text}" found` : `FAIL: text "${text}" not found`;
        return jsonContent({ pass, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return textContent({ type: 'text', text: `assert_text failed: ${message}` });
      }
    }
  );

  // ─── assert_visible ─────────────────────────────────────────────
  registerTool(
    server,
    'assert_visible',
    'Assert that an element matching the selector is visible (exists in Fiber tree). Returns { pass: boolean, message: string }. Supports polling with timeoutMs/intervalMs for CI stability.',
    assertVisibleSchema,
    async (args: unknown) => {
      const { selector, timeoutMs, intervalMs, deviceId, platform } =
        assertVisibleSchema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return textContent({ type: 'text', text: 'No React Native app connected.' });
      }

      const code = buildQuerySelectorEvalCode(selector);
      const requestTimeout = Math.max(10000, timeoutMs + 5000);

      try {
        const result = await pollUntil(
          async () => {
            const res = await appSession.sendRequest(
              { method: 'eval', params: { code } },
              requestTimeout,
              deviceId,
              platform
            );
            if (res.error != null) return { pass: false, error: res.error };
            return { pass: res.result != null };
          },
          timeoutMs,
          intervalMs
        );

        if (result.error) {
          return textContent({ type: 'text', text: `Error: ${result.error}` });
        }
        const pass = result.pass;
        const message = pass
          ? `PASS: element matching "${selector}" found`
          : `FAIL: element matching "${selector}" not found`;
        return jsonContent({ pass, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return textContent({ type: 'text', text: `assert_visible failed: ${message}` });
      }
    }
  );

  // ─── assert_not_visible ─────────────────────────────────────────
  registerTool(
    server,
    'assert_not_visible',
    'Assert that an element matching the selector is NOT visible (not found in Fiber tree). Returns { pass: boolean, message: string }. Supports polling with timeoutMs/intervalMs — waits until element disappears.',
    assertNotVisibleSchema,
    async (args: unknown) => {
      const { selector, timeoutMs, intervalMs, deviceId, platform } =
        assertNotVisibleSchema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return textContent({ type: 'text', text: 'No React Native app connected.' });
      }

      const code = buildQuerySelectorEvalCode(selector);
      const requestTimeout = Math.max(10000, timeoutMs + 5000);

      try {
        const result = await pollUntil(
          async () => {
            const res = await appSession.sendRequest(
              { method: 'eval', params: { code } },
              requestTimeout,
              deviceId,
              platform
            );
            if (res.error != null) return { pass: false, error: res.error };
            // pass when element NOT found
            return { pass: res.result == null };
          },
          timeoutMs,
          intervalMs
        );

        if (result.error) {
          return textContent({ type: 'text', text: `Error: ${result.error}` });
        }
        const pass = result.pass;
        const message = pass
          ? `PASS: element matching "${selector}" not found (as expected)`
          : `FAIL: element matching "${selector}" still visible`;
        return jsonContent({ pass, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return textContent({
          type: 'text',
          text: `assert_not_visible failed: ${message}`,
        });
      }
    }
  );

  // ─── assert_element_count ───────────────────────────────────────
  registerTool(
    server,
    'assert_element_count',
    'Assert the count of elements matching a selector. Specify expectedCount for exact match, or minCount/maxCount for range. Returns { pass: boolean, actualCount: number, message: string }. Supports polling with timeoutMs/intervalMs.',
    assertElementCountSchema,
    async (args: unknown) => {
      const {
        selector,
        expectedCount,
        minCount,
        maxCount,
        timeoutMs,
        intervalMs,
        deviceId,
        platform,
      } = assertElementCountSchema.parse(args);

      if (!appSession.isConnected(deviceId, platform)) {
        return textContent({ type: 'text', text: 'No React Native app connected.' });
      }

      const code = buildQuerySelectorAllEvalCode(selector);
      const requestTimeout = Math.max(10000, timeoutMs + 5000);

      function checkCount(count: number): boolean {
        if (expectedCount != null) return count === expectedCount;
        let ok = true;
        if (minCount != null) ok = ok && count >= minCount;
        if (maxCount != null) ok = ok && count <= maxCount;
        return ok;
      }

      try {
        const result = await pollUntil(
          async () => {
            const res = await appSession.sendRequest(
              { method: 'eval', params: { code } },
              requestTimeout,
              deviceId,
              platform
            );
            if (res.error != null) return { pass: false, actualCount: 0, error: res.error };
            const arr = Array.isArray(res.result) ? res.result : [];
            const actualCount = arr.length;
            return { pass: checkCount(actualCount), actualCount };
          },
          timeoutMs,
          intervalMs
        );

        if (result.error) {
          return textContent({ type: 'text', text: `Error: ${result.error}` });
        }
        const { pass, actualCount } = result as { pass: boolean; actualCount: number };
        const expected =
          expectedCount != null
            ? `exactly ${expectedCount}`
            : `${minCount != null ? `>=${minCount}` : ''}${minCount != null && maxCount != null ? ' and ' : ''}${maxCount != null ? `<=${maxCount}` : ''}`;
        const message = pass
          ? `PASS: found ${actualCount} elements (expected ${expected})`
          : `FAIL: found ${actualCount} elements (expected ${expected})`;
        return jsonContent({ pass, actualCount, message });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return textContent({
          type: 'text',
          text: `assert_element_count failed: ${message}`,
        });
      }
    }
  );
}
