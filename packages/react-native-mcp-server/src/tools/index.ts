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
import { registerIdbListTargets } from './idb-list-targets.js';
import { registerIdbTap } from './idb-tap.js';
import { registerIdbSwipe } from './idb-swipe.js';
import { registerIdbText } from './idb-text.js';
import { registerIdbKey } from './idb-key.js';
import { registerIdbDescribe } from './idb-describe.js';
import { registerIdbButton } from './idb-button.js';
import { registerIdbFilePush } from './idb-file-push.js';
import { registerIdbAddMedia } from './idb-add-media.js';
import { registerAdbListDevices } from './adb-list-devices.js';
import { registerAdbTap } from './adb-tap.js';
import { registerAdbSwipe } from './adb-swipe.js';
import { registerAdbText } from './adb-text.js';
import { registerAdbKey } from './adb-key.js';
import { registerAdbButton } from './adb-button.js';
import { registerAdbDescribe } from './adb-describe.js';
import { registerAdbFilePush } from './adb-file-push.js';
import { registerAdbAddMedia } from './adb-add-media.js';
import { registerSwitchKeyboard } from './switch-keyboard.js';
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
  // idb (iOS Development Bridge) 도구 — 네이티브 터치 주입, 시뮬레이터 제어
  registerIdbListTargets(server);
  registerIdbTap(server);
  registerIdbSwipe(server);
  registerIdbText(server);
  registerIdbKey(server);
  registerIdbDescribe(server);
  registerIdbButton(server);
  // idb 추가 도구 — 파일 전송, 미디어 추가
  registerIdbFilePush(server);
  registerIdbAddMedia(server);
  // adb (Android Debug Bridge) 도구 — 네이티브 터치 주입, 디바이스 제어
  registerAdbListDevices(server);
  registerAdbTap(server);
  registerAdbSwipe(server);
  registerAdbText(server);
  registerAdbKey(server);
  registerAdbButton(server);
  registerAdbDescribe(server);
  registerAdbFilePush(server);
  registerAdbAddMedia(server);
  // 키보드 전환 — idb_text / adb_text 사용 전 언어 전환
  registerSwitchKeyboard(server);
}
