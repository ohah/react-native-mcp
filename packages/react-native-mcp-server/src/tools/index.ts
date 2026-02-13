/**
 * MCP 도구 등록 집합
 * DESIGN.md Phase 1~5 로드맵. Chrome DevTools MCP 스펙 정렬: docs/chrome-devtools-mcp-spec-alignment.md
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { registerClickWebView } from './click-webview.js';
import { registerEvaluateScript } from './eval-code.js';
import { registerGetMetroUrl } from './get-metro-url.js';
import { registerListConsoleMessages } from './list-console-messages.js';
import { registerListNetworkRequests } from './list-network-requests.js';
import { registerListPages } from './list-pages.js';
import { registerTakeScreenshot } from './take-screenshot.js';

export function registerAllTools(server: McpServer, appSession: AppSession): void {
  registerEvaluateScript(server, appSession);
  registerTakeScreenshot(server);
  registerClickWebView(server, appSession);
  registerListPages(server);
  registerGetMetroUrl(server);
  registerListConsoleMessages(server);
  registerListNetworkRequests(server);
}
