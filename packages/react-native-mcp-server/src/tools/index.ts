/**
 * MCP 도구 등록 집합
 * DESIGN.md Phase 1~5 로드맵. Chrome DevTools MCP 스펙 정렬: docs/chrome-devtools-mcp-spec-alignment.md
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { registerAssert } from './assert.js';
import { registerClick } from './click.js';
import { registerClickByLabel } from './click-by-label.js';
import { registerWebviewEvaluateScript } from './webview-evaluate-script.js';
import { registerEvaluateScript } from './eval-code.js';
import { registerGetDebuggerStatus } from './get-debugger-status.js';
import { registerListClickables } from './list-clickables.js';
import { registerListConsoleMessages } from './list-console-messages.js';
import { registerListNetworkRequests } from './list-network-requests.js';
import { registerListPages } from './list-pages.js';
import { registerListTextNodes } from './list-text-nodes.js';
import { registerLongPress } from './long-press.js';
import { registerLongPressByLabel } from './long-press-by-label.js';
import { registerQuerySelector } from './query-selector.js';
import { registerScroll } from './scroll.js';
import { registerTakeScreenshot } from './take-screenshot.js';
import { registerTakeSnapshot } from './take-snapshot.js';
import { registerTypeText } from './type-text.js';
import { registerSwitchKeyboard } from './switch-keyboard.js';
// 통합 네이티브 도구 (platform 파라미터로 iOS/Android 분기)
import { registerTap } from './tap.js';
import { registerSwipe } from './swipe.js';
import { registerInputText } from './input-text.js';
import { registerInputKey } from './input-key.js';
import { registerPressButton } from './press-button.js';
import { registerDescribeUi } from './describe-ui.js';
import { registerFilePush } from './file-push.js';
import { registerAddMedia } from './add-media.js';
import { registerListDevices } from './list-devices.js';

export function registerAllTools(server: McpServer, appSession: AppSession): void {
  registerEvaluateScript(server, appSession);
  registerTakeSnapshot(server, appSession);
  registerTakeScreenshot(server);
  registerScroll(server, appSession);
  registerClick(server, appSession);
  registerClickByLabel(server, appSession);
  registerWebviewEvaluateScript(server, appSession);
  registerLongPress(server, appSession);
  registerLongPressByLabel(server, appSession);
  registerTypeText(server, appSession);
  registerListClickables(server, appSession);
  registerListTextNodes(server, appSession);
  registerListPages(server);
  registerQuerySelector(server, appSession);
  registerAssert(server, appSession);
  registerGetDebuggerStatus(server, appSession);
  registerListConsoleMessages(server, appSession);
  registerListNetworkRequests(server, appSession);
  // 통합 네이티브 도구 — 좌표 탭/스와이프, 텍스트 입력, 키코드, 버튼, UI 트리, 파일, 미디어
  registerTap(server);
  registerSwipe(server);
  registerInputText(server);
  registerInputKey(server);
  registerPressButton(server);
  registerDescribeUi(server);
  registerFilePush(server);
  registerAddMedia(server);
  registerListDevices(server);
  // 키보드 전환 — input_text 사용 전 언어 전환
  registerSwitchKeyboard(server);
}
