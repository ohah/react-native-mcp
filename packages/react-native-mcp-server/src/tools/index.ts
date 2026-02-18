/**
 * MCP 도구 등록 집합
 * DESIGN.md Phase 1~5 로드맵. Chrome DevTools MCP 스펙 정렬: docs/chrome-devtools-mcp-spec-alignment.md
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { AppSession } from '../websocket-server.js';
import { registerAssert } from './assert.js';
import { registerWebviewEvaluateScript } from './webview-evaluate-script.js';
import { registerEvaluateScript } from './eval-code.js';
import { registerGetDebuggerStatus } from './get-debugger-status.js';
import { registerListConsoleMessages } from './list-console-messages.js';
import { registerListNetworkRequests } from './list-network-requests.js';
import { registerQuerySelector } from './query-selector.js';
import { registerTakeScreenshot } from './take-screenshot.js';
import { registerTakeSnapshot } from './take-snapshot.js';
import { registerAccessibilityAudit } from './accessibility-audit.js';
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
import { registerOpenDeeplink } from './open-deeplink.js';
import { registerClearState } from './clear-state.js';
import { registerSetLocation } from './set-location.js';
import { registerScrollUntilVisible } from './scroll-until-visible.js';
import { registerInspectState } from './inspect-state.js';
import { registerGetStateChanges } from './get-state-changes.js';
import { registerNetworkMock } from './network-mock.js';

export function registerAllTools(server: McpServer, appSession: AppSession): void {
  registerEvaluateScript(server, appSession);
  registerTakeSnapshot(server, appSession);
  registerTakeScreenshot(server, appSession);
  registerAccessibilityAudit(server, appSession);
  registerWebviewEvaluateScript(server, appSession);
  registerTypeText(server, appSession);
  registerQuerySelector(server, appSession);
  registerAssert(server, appSession);
  registerGetDebuggerStatus(server, appSession);
  registerListConsoleMessages(server, appSession);
  registerListNetworkRequests(server, appSession);
  // 통합 네이티브 도구 — 좌표 탭/스와이프, 텍스트 입력, 키코드, 버튼, UI 트리, 파일, 미디어
  registerTap(server, appSession);
  registerSwipe(server, appSession);
  registerInputText(server);
  registerInputKey(server);
  registerPressButton(server);
  registerDescribeUi(server);
  registerFilePush(server);
  registerAddMedia(server);
  registerListDevices(server);
  // 키보드 전환 — input_text 사용 전 언어 전환
  registerSwitchKeyboard(server);
  // 딥링크
  registerOpenDeeplink(server);
  // 앱 데이터/권한 초기화, 위치 설정 (시뮬/에뮬)
  registerClearState(server);
  registerSetLocation(server);
  // scroll_until_visible — 요소가 보일 때까지 자동 스크롤
  registerScrollUntilVisible(server, appSession);
  // React 상태 인스펙션 — state Hook 조회 및 변경 이력
  registerInspectState(server, appSession);
  registerGetStateChanges(server, appSession);
  // 네트워크 모킹
  registerNetworkMock(server, appSession);
}
