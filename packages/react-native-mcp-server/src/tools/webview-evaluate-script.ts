/**
 * MCP 도구: webview_evaluate_script
 * 앱에 등록된 WebView 내부에서 임의의 JavaScript를 실행 (injectJavaScript)
 * Babel 플러그인(babel-plugin-inject-testid)이 <WebView> 태그를 자동 감지하여
 * registerWebView/unregisterWebView/onMessage를 주입하므로, 별도 수동 등록 없이
 * evaluate_script로 getRegisteredWebViewIds()를 호출하면 사용 가능한 ID를 확인할 수 있다.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  webViewId: z
    .string()
    .describe('WebView id. Use evaluate_script getRegisteredWebViewIds() to discover.'),
  script: z
    .string()
    .describe('JS to run in WebView (DOM query, click, etc). Must evaluate to value for result.'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerWebviewEvaluateScript(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'webview_evaluate_script',
    {
      description:
        'Run JS in WebView. Prefer over tap for DOM interactions. Get webViewId via evaluate_script getRegisteredWebViewIds().',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { webViewId, script, deviceId, platform } = schema.parse(args);

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

      const code = `(function(){ return __REACT_NATIVE_MCP__.evaluateInWebViewAsync(${JSON.stringify(webViewId)}, ${JSON.stringify(script)}); })();`;
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          15000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${res.error}` }],
          };
        }
        const result = res.result as { ok?: boolean; value?: string; error?: string } | undefined;
        if (result && result.ok === true && result.value !== undefined) {
          return {
            content: [{ type: 'text' as const, text: result.value }],
          };
        }
        if (result && result.ok === false && result.error != null) {
          return {
            content: [{ type: 'text' as const, text: `WebView error: ${result.error}` }],
          };
        }
        if (result && result.ok === true) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `OK: script executed in WebView "${webViewId}". (No result: app may not forward onMessage to handleWebViewMessage.)`,
              },
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
          isError: true,
          content: [{ type: 'text' as const, text: `Request failed: ${message}` }],
        };
      }
    }
  );
}
