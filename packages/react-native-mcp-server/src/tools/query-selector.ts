/**
 * MCP 도구: query_selector, query_selector_all
 * Fiber 트리에서 셀렉터로 요소 검색. CSS querySelector와 유사하지만 React Native Fiber 트리 전용.
 *
 * 셀렉터 문법:
 *   Type#testID[attr="val"]:text("..."):nth-of-type(N):has-press:has-scroll
 *   A > B (직접 자식), A B (후손), A, B (OR)
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const selectorDescription =
  'Selector for RN Fiber tree. Read resource docs://guides/query-selector-syntax for full syntax (type, #testID, :text, hierarchy, etc.).';

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

/** WebView 감지 시 등록된 webViewId 목록을 조회해 힌트로 반환 */
async function getWebViewHint(
  appSession: AppSession,
  deviceId?: string,
  platform?: string
): Promise<string> {
  try {
    const code = `(function(){ return typeof __REACT_NATIVE_MCP__ !== 'undefined' && __REACT_NATIVE_MCP__.getRegisteredWebViewIds ? __REACT_NATIVE_MCP__.getRegisteredWebViewIds() : []; })();`;
    const res = await appSession.sendRequest(
      { method: 'eval', params: { code } },
      5000,
      deviceId,
      platform
    );
    const ids = Array.isArray(res.result) ? (res.result as string[]) : [];
    if (ids.length === 0) {
      return '\n\n⚠️ This is a WebView but no WebView IDs are registered. Coordinate-based tap may be needed, or ensure the Babel plugin is configured.';
    }
    const idList = ids.map((id) => `"${id}"`).join(', ');
    return `\n\n💡 WebView detected. Use webview_evaluate_script to interact with its DOM content (click, read text, etc.) — do NOT use coordinate-based tap.\nRegistered WebView IDs: [${idList}]\nExample: webview_evaluate_script(webViewId: ${ids.length === 1 ? `"${ids[0]}"` : `<pick one>`}, script: "document.querySelector('button').click()")`;
  } catch {
    return '\n\n💡 This is a WebView. Use webview_evaluate_script instead of tap for DOM interactions.';
  }
}

function isWebViewType(typeName: string): boolean {
  return typeName === 'RNCWebView' || typeName.includes('WebView');
}

/** JSON → compact 한 줄: "Type #testID uid=xxx pageX=N pageY=N width=N height=N" */
function formatElementCompact(el: Record<string, unknown>): string {
  const type = String(el.type ?? '');
  const uid = String(el.uid ?? '');
  const testID = String(el.testID ?? '');
  const pageX = el.pageX != null ? Math.round(Number(el.pageX)) : null;
  const pageY = el.pageY != null ? Math.round(Number(el.pageY)) : null;
  const width = el.width != null ? Math.round(Number(el.width)) : null;
  const height = el.height != null ? Math.round(Number(el.height)) : null;

  const parts: string[] = [type || 'element'];
  if (testID) parts.push(`#${testID}`);
  if (uid && uid !== testID) parts.push(`uid=${uid}`);
  if (pageX != null) parts.push(`pageX=${pageX}`);
  if (pageY != null) parts.push(`pageY=${pageY}`);
  if (width != null) parts.push(`width=${width}`);
  if (height != null) parts.push(`height=${height}`);
  return parts.join(' ');
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
    'Find first element matching selector. Returns uid, type, and position (pageX, pageY, width, height) for tap.',
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
        if (res.result == null) {
          return {
            content: [{ type: 'text' as const, text: 'No element matches selector: ' + selector }],
          };
        }
        const result = res.result as Record<string, unknown>;
        let text = formatElementCompact(result);
        if (isWebViewType(String(result.type ?? ''))) {
          text += await getWebViewHint(appSession, deviceId, platform);
        }
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `query_selector failed: ${message}` }],
        };
      }
    }
  );

  register(
    'query_selector_all',
    'Find all elements matching selector. Returns array with positions. Use query_selector for single element.',
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
        const list = Array.isArray(res.result) ? (res.result as Record<string, unknown>[]) : [];
        if (list.length === 0) {
          return {
            content: [{ type: 'text' as const, text: 'No elements match selector: ' + selector }],
          };
        }
        const lines = [`# ${list.length} matches`];
        for (const el of list) {
          lines.push(`- ${formatElementCompact(el)}`);
        }
        let text = lines.join('\n');
        const hasWebView = list.some((el) => isWebViewType(String(el.type ?? '')));
        if (hasWebView) {
          text += await getWebViewHint(appSession, deviceId, platform);
        }
        return { content: [{ type: 'text' as const, text }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `query_selector_all failed: ${message}` }],
        };
      }
    }
  );
}
