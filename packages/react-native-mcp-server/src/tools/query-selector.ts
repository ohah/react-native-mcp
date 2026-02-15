/**
 * MCP 도구: query_selector, query_selector_all
 * Fiber 트리에서 셀렉터로 요소 검색. CSS querySelector와 유사하지만 React Native Fiber 트리 전용.
 *
 * 셀렉터 문법:
 *   Type#testID[attr="val"]:text("..."):nth(N):has-press:has-scroll
 *   A > B (직접 자식), A B (후손), A, B (OR)
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const selectorDescription = `Selector syntax for React Native Fiber tree:
- By type: ScrollView, Pressable, Text, View
- By testID: #product-list
- By text: :text("Login") (substring match on subtree text)
- By attribute: [accessibilityLabel="Close"]
- Combined: Pressable:text("Submit"), ScrollView#main
- Hierarchy: View > ScrollView (direct child), View ScrollView (descendant)
- Index: :nth(0) for nth match (0-based)
- Capabilities: :has-press (has onPress), :has-scroll (has scrollTo)
- Union: ScrollView, FlatList (comma = OR)
See docs/query-selector.md for full syntax reference.`;

const schema = z.object({
  selector: z.string().describe(selectorDescription),
  deviceId: deviceParam,
  platform: platformParam,
});

export function buildQuerySelectorEvalCode(selector: string): string {
  return `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; return M && M.querySelectorWithMeasure ? M.querySelectorWithMeasure(${JSON.stringify(selector)}) : null; })();`;
}

export function buildQuerySelectorAllEvalCode(selector: string): string {
  return `(function(){ var M = typeof __REACT_NATIVE_MCP__ !== 'undefined' ? __REACT_NATIVE_MCP__ : null; return M && M.querySelectorAllWithMeasure ? M.querySelectorAllWithMeasure(${JSON.stringify(selector)}) : []; })();`;
}

export function registerQuerySelector(server: McpServer, appSession: AppSession): void {
  const register = (
    name: string,
    description: string,
    handler: (args: unknown) => Promise<unknown>
  ) => {
    (
      server as {
        registerTool(
          name: string,
          def: { description: string; inputSchema: z.ZodTypeAny },
          handler: (args: unknown) => Promise<unknown>
        ): void;
      }
    ).registerTool(name, { description, inputSchema: schema }, handler);
  };

  register(
    'query_selector',
    'Find the first element matching a selector in the Fiber tree. Returns { uid, type, testID?, text?, ... }. Includes measure coordinates ({ x, y, width, height, pageX, pageY }) — no separate measureView call needed. Workflow: query_selector → tap(pageX + width/2, pageY + height/2). You do not know uids in advance — call this first.',
    async (args: unknown) => {
      const { selector, deviceId, platform } = schema.parse(args);
      if (!appSession.isConnected(deviceId, platform)) {
        return { content: [{ type: 'text' as const, text: 'No React Native app connected.' }] };
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
        const text =
          res.result == null
            ? 'No element matches selector: ' + selector
            : JSON.stringify(res.result, null, 2);
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: 'text' as const, text: `query_selector failed: ${message}` }] };
      }
    }
  );

  register(
    'query_selector_all',
    'Find all elements matching a selector in the Fiber tree. Returns array of { uid, type, testID?, text?, accessibilityLabel?, hasOnPress, hasOnLongPress, hasScrollTo, measure }. Each element includes measure coordinates. WARNING: Can return large payloads. Prefer query_selector for single element. Use this only when you need to enumerate multiple elements.',
    async (args: unknown) => {
      const { selector, deviceId, platform } = schema.parse(args);
      if (!appSession.isConnected(deviceId, platform)) {
        return { content: [{ type: 'text' as const, text: 'No React Native app connected.' }] };
      }
      const code = buildQuerySelectorAllEvalCode(selector);
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
        const list = Array.isArray(res.result) ? res.result : [];
        const text =
          list.length > 0
            ? JSON.stringify(list, null, 2)
            : 'No elements match selector: ' + selector;
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `query_selector_all failed: ${message}` }],
        };
      }
    }
  );
}
