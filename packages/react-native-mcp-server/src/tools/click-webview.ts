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
      'JavaScript code to execute inside the WebView (e.g. "document.querySelector(\'button\').click()" or "document.title").'
    ),
  deviceId: deviceParam,
  platform: platformParam,
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
    'webview_evaluate_script',
    {
      description:
        'Run a JavaScript function in the in-app WebView context. App must register the WebView via __REACT_NATIVE_MCP__.registerWebView(ref, id) (react-native-webview).',
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

      const code = `(function(){ return __REACT_NATIVE_MCP__.evaluateInWebView(${JSON.stringify(webViewId)}, ${JSON.stringify(script)}); })();`;
      try {
        const res = await appSession.sendRequest(
          { method: 'eval', params: { code } },
          10000,
          deviceId,
          platform
        );
        if (res.error != null) {
          return {
            content: [{ type: 'text' as const, text: `Error: ${res.error}` }],
          };
        }
        const result = res.result as { ok?: boolean; error?: string } | undefined;
        if (result && result.ok === true) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `OK: script executed in WebView "${webViewId}".`,
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
