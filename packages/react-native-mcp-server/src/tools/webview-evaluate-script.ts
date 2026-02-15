/**
 * MCP 도구: webview_evaluate_script
 * 앱에 등록된 WebView 내부에서 임의의 JavaScript를 실행 (injectJavaScript)
 * 앱에서 __REACT_NATIVE_MCP__.registerWebView(ref, id)로 웹뷰를 등록해 두어야 함.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  webViewId: z.string().describe('WebView id registered in the app via registerWebView(ref, id).'),
  script: z
    .string()
    .describe(
      'JavaScript expression to execute in the WebView. To get the value back, the expression must evaluate to a value (e.g. "document.title" or "document.querySelector(\'h1\').innerText"). App must forward onMessage to handleWebViewMessage for result feedback.'
    ),
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
        'Run JavaScript in the in-app WebView context. App must register the WebView via __REACT_NATIVE_MCP__.registerWebView(ref, id) (react-native-webview). ' +
        'Execution result: forward onMessage with __REACT_NATIVE_MCP__.createWebViewOnMessage(yourHandler) so MCP gets script result and your own postMessage logic still runs; otherwise only OK/error is returned.',
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
          content: [{ type: 'text' as const, text: `Request failed: ${message}` }],
        };
      }
    }
  );
}
