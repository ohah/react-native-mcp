/**
 * MCP 도구: click_webview
 * 앱에 등록된 WebView 내부에서 CSS selector에 해당하는 요소 클릭 (injectJavaScript)
 * 앱에서 __REACT_NATIVE_MCP__.registerWebView(ref, id)로 웹뷰를 등록해 두어야 함.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';

const schema = z.object({
  webViewId: z.string().describe('앱에서 registerWebView(ref, id)로 등록한 웹뷰 식별자'),
  selector: z.string().describe('WebView 내부 DOM의 CSS selector (예: "button.submit", "#ok")'),
});

export function registerClickWebView(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'click_webview',
    {
      description:
        '앱 내 WebView에서 CSS selector에 해당하는 요소를 클릭. 앱에서 __REACT_NATIVE_MCP__.registerWebView(ref, id)로 웹뷰를 등록해야 함 (react-native-webview 사용).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { webViewId, selector } = schema.parse(args);

      if (!appSession.isConnected()) {
        return {
          content: [
            {
              type: 'text' as const,
              text: 'No React Native app connected. Start the app with Metro and ensure the MCP runtime is loaded.',
            },
          ],
        };
      }

      const code = `(function(){ return __REACT_NATIVE_MCP__.clickInWebView(${JSON.stringify(webViewId)}, ${JSON.stringify(selector)}); })();`;
      try {
        const res = await appSession.sendRequest({ method: 'eval', params: { code } });
        if (res.error != null) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${res.error}` }],
          };
        }
        const result = res.result as { ok?: boolean; error?: string } | undefined;
        if (result && result.ok === true) {
          return {
            content: [
              { type: 'text' as const, text: 'OK: click() executed on element inside WebView.' },
            ],
          };
        }
        return {
          content: [
            {
              type: 'text' as const,
              text: result?.error ?? JSON.stringify(result ?? res.result),
            },
          ],
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          content: [{ type: 'text' as const, text: `Request failed: ${message}` }],
        };
      }
    }
  );
}
