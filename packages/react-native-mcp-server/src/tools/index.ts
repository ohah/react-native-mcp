/**
 * MCP 도구 등록 집합
 * DESIGN.md Phase 1~5 로드맵. Chrome DevTools MCP 스펙 정렬: docs/chrome-devtools-mcp-spec-alignment.md
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { registerClick } from './click.js';
import { registerClickByLabel } from './click-by-label.js';
import { registerClickWebView } from './click-webview.js';
import { registerEvaluateScript } from './eval-code.js';
import { registerGetDebuggerStatus } from './get-debugger-status.js';
import { registerListClickables } from './list-clickables.js';
import { registerListPages } from './list-pages.js';
import { registerListTextNodes } from './list-text-nodes.js';
import { registerQuerySelector } from './query-selector.js';
import { registerScroll } from './scroll.js';
import { registerTakeScreenshot } from './take-screenshot.js';
import { registerTakeSnapshot } from './take-snapshot.js';

export function registerAllTools(server: McpServer, appSession: AppSession): void {
  registerEvaluateScript(server, appSession);
  registerTakeSnapshot(server, appSession);
  registerTakeScreenshot(server);
  registerScroll(server, appSession);
  registerClick(server, appSession);
  registerClickByLabel(server, appSession);
  registerClickWebView(server, appSession);
  registerListClickables(server, appSession);
  registerListTextNodes(server, appSession);
  registerListPages(server);
  registerQuerySelector(server, appSession);
  registerGetDebuggerStatus(server, appSession);
}
