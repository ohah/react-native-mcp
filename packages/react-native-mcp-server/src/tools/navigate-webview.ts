/**
 * MCP 도구: navigate_webview
 * 등록된 WebView에서 URL로 이동 (injectJavaScript로 window.location.href 설정)
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';

const schema = z.object({
  webViewId: z.string().describe('WebView id registered via registerWebView(ref, id).'),
  url: z.string().describe('URL to navigate to (e.g. https://www.google.com/search?q=네이버).'),
  deviceId: deviceParam,
  platform: platformParam,
});

export function registerNavigateWebView(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'navigate_webview',
    {
      description:
        'Navigate the in-app WebView to the given URL. App must register the WebView via __REACT_NATIVE_MCP__.registerWebView(ref, id).',
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { webViewId, url, deviceId, platform } = schema.parse(args);

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

      const code = `(function(){ return __REACT_NATIVE_MCP__.navigateWebView(${JSON.stringify(webViewId)}, ${JSON.stringify(url)}); })();`;
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
              { type: 'text' as const, text: `OK: WebView "${webViewId}" navigating to ${url}.` },
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
