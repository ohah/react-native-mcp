/**
 * MCP 도구: webview_tap
 * WebView 내부 DOM 요소의 CSS 셀렉터를 받아 getBoundingClientRect()로 위치를 계산한 뒤,
 * WebView 자체의 네이티브 좌표(pageX/pageY)를 더해 절대 화면 좌표를 산출하고
 * 기존 idb/adb tap 로직으로 네이티브 탭을 수행한다.
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { deviceParam, platformParam } from './device-param.js';
import { buildQuerySelectorEvalCode } from './query-selector.js';
import {
  checkIdbAvailable,
  resolveUdid,
  runIdbCommand,
  idbNotInstalledError,
} from './idb-utils.js';
import {
  checkAdbAvailable,
  resolveSerial,
  runAdbCommand,
  adbNotInstalledError,
  getAndroidScale,
} from './adb-utils.js';
import { getIOSOrientationInfo, transformForIdb } from './ios-landscape.js';

const TAP_TIMEOUT_MS =
  typeof process.env.REACT_NATIVE_MCP_TAP_TIMEOUT_MS !== 'undefined'
    ? Math.max(5000, parseInt(process.env.REACT_NATIVE_MCP_TAP_TIMEOUT_MS, 10) || 10000)
    : 10000;

const schema = z.object({
  webViewId: z
    .string()
    .describe('WebView id. Use evaluate_script getRegisteredWebViewIds() to discover.'),
  selector: z.string().describe('CSS selector for the DOM element inside the WebView to tap.'),
  webViewSelector: z
    .string()
    .optional()
    .describe(
      'RN Fiber selector for the WebView element itself (e.g. "RNCWebView" or "#myWebView"). Auto-detected if omitted.'
    ),
  deviceId: deviceParam,
  platform: platformParam,
});

/** WebView 내부에서 CSS 셀렉터의 getBoundingClientRect 정보를 가져오는 스크립트 */
function buildDomRectScript(cssSelector: string): string {
  return `(function(){
  var el = document.querySelector(${JSON.stringify(cssSelector)});
  if (!el) return JSON.stringify({ error: 'No element matches selector: ' + ${JSON.stringify(cssSelector)} });
  var r = el.getBoundingClientRect();
  return JSON.stringify({ left: r.left, top: r.top, width: r.width, height: r.height });
})()`;
}

export function registerWebviewTap(server: McpServer, appSession: AppSession): void {
  (
    server as {
      registerTool(
        name: string,
        def: { description: string; inputSchema: z.ZodTypeAny },
        handler: (args: unknown) => Promise<unknown>
      ): void;
    }
  ).registerTool(
    'webview_tap',
    {
      description:
        "Tap a DOM element inside a WebView using native tap. Resolves CSS selector to screen coordinates via getBoundingClientRect + WebView native position, then taps via idb/adb. Use this when you need a real native tap on WebView content (e.g. for elements that don't respond to JS click).",
      inputSchema: schema,
    },
    async (args: unknown) => {
      const { webViewId, selector, webViewSelector, deviceId, platform } = schema.parse(args);

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

      try {
        // Step 1: Get DOM element rect via webview_evaluate_script
        const domScript = buildDomRectScript(selector);
        const evalCode = `(function(){ return __REACT_NATIVE_MCP__.evaluateInWebViewAsync(${JSON.stringify(webViewId)}, ${JSON.stringify(domScript)}); })();`;
        const evalRes = await appSession.sendRequest(
          { method: 'eval', params: { code: evalCode } },
          15000,
          deviceId,
          platform
        );

        if (evalRes.error != null) {
          return {
            content: [{ type: 'text' as const, text: `WebView eval error: ${evalRes.error}` }],
          };
        }

        const evalResult = evalRes.result as
          | { ok?: boolean; value?: string; error?: string }
          | undefined;
        if (!evalResult || evalResult.ok !== true || !evalResult.value) {
          const errMsg = evalResult?.error ?? 'Failed to get DOM element rect from WebView';
          return {
            content: [{ type: 'text' as const, text: `WebView error: ${errMsg}` }],
          };
        }

        let domRect: { left: number; top: number; width: number; height: number; error?: string };
        try {
          domRect = JSON.parse(evalResult.value);
        } catch {
          return {
            content: [
              {
                type: 'text' as const,
                text: `Failed to parse DOM rect: ${evalResult.value}`,
              },
            ],
          };
        }

        if (domRect.error) {
          return {
            content: [{ type: 'text' as const, text: domRect.error }],
          };
        }

        // Step 2: Get WebView native position via query_selector
        const wvSelector = webViewSelector ?? 'RNCWebView';
        const qsCode = buildQuerySelectorEvalCode(wvSelector);
        const qsRes = await appSession.sendRequest(
          { method: 'eval', params: { code: qsCode } },
          10000,
          deviceId,
          platform
        );

        if (qsRes.error != null) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `query_selector error for WebView: ${qsRes.error}`,
              },
            ],
          };
        }

        if (qsRes.result == null) {
          return {
            content: [
              {
                type: 'text' as const,
                text: `WebView element not found with selector "${wvSelector}". Use webViewSelector param to specify the correct RN selector.`,
              },
            ],
          };
        }

        const webViewEl = qsRes.result as {
          pageX?: number;
          pageY?: number;
          width?: number;
          height?: number;
        };
        const wvPageX = webViewEl.pageX ?? 0;
        const wvPageY = webViewEl.pageY ?? 0;

        // Step 3: Calculate absolute screen coordinates (center of DOM element)
        const x = wvPageX + domRect.left + domRect.width / 2;
        const y = wvPageY + domRect.top + domRect.height / 2;

        // Step 4: Perform native tap via idb/adb (same logic as tap tool)
        const resolvedPlatform = platform ?? 'ios';

        if (resolvedPlatform === 'ios') {
          if (!(await checkIdbAvailable())) return idbNotInstalledError();
          const udid = await resolveUdid(deviceId);
          const info = await getIOSOrientationInfo(appSession, deviceId, resolvedPlatform, udid);
          const t = transformForIdb(x, y, info);
          const ix = Math.round(t.x);
          const iy = Math.round(t.y);
          const cmd = ['ui', 'tap', String(ix), String(iy)];
          try {
            await runIdbCommand(cmd, udid, { timeoutMs: TAP_TIMEOUT_MS });
          } catch (tapErr) {
            const msg = tapErr instanceof Error ? tapErr.message : String(tapErr);
            if (msg.includes('Command timed out')) {
              await new Promise((r) => setTimeout(r, 1500));
              await runIdbCommand(cmd, udid, { timeoutMs: TAP_TIMEOUT_MS });
            } else {
              throw tapErr;
            }
          }
          await new Promise((r) => setTimeout(r, 300));
          return {
            content: [
              {
                type: 'text' as const,
                text: `Tapped WebView DOM element "${selector}" at (${ix}, ${iy}) on iOS simulator ${udid}. [webViewId=${webViewId}, domRect=(${Math.round(domRect.left)},${Math.round(domRect.top)}), webView=(${Math.round(wvPageX)},${Math.round(wvPageY)})]`,
              },
            ],
          };
        } else {
          if (!(await checkAdbAvailable())) return adbNotInstalledError();
          const serial = await resolveSerial(deviceId);
          await appSession.ensureAndroidTopInset(deviceId, serial);
          const scale =
            appSession.getPixelRatio(undefined, 'android') ?? (await getAndroidScale(serial));
          const topInsetDp = appSession.getTopInsetDp(deviceId, 'android');
          const px = Math.round(x * scale);
          const py = Math.round((y + topInsetDp) * scale);
          await runAdbCommand(['shell', 'input', 'tap', String(px), String(py)], serial, {
            timeoutMs: TAP_TIMEOUT_MS,
          });
          await new Promise((r) => setTimeout(r, 300));
          return {
            content: [
              {
                type: 'text' as const,
                text: `Tapped WebView DOM element "${selector}" at dp(${Math.round(x)}, ${Math.round(y)}) -> px(${px}, ${py}) [scale=${scale}] on Android device ${serial}. [webViewId=${webViewId}, domRect=(${Math.round(domRect.left)},${Math.round(domRect.top)}), webView=(${Math.round(wvPageX)},${Math.round(wvPageY)})]`,
              },
            ],
          };
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `webview_tap failed: ${message}` }],
        };
      }
    }
  );
}
