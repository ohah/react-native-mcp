/**
 * React Native 앱에 주입되는 MCP 런타임
 * - __REACT_NATIVE_MCP__.registerComponent → AppRegistry.registerComponent 위임
 * - __DEV__ 시 WebSocket으로 MCP 서버(12300)에 연결, eval 요청 처리
 *
 * Metro transformer가 진입점 상단에 require('@ohah/react-native-mcp-server/runtime') 주입
 * global은 모듈 로드 직후 최상단에서 설정해 ReferenceError 방지.
 */

'use strict';

// Phase 1: 부트스트랩
import './devtools-hook'; // hook 설치 (최우선)

// Phase 2: 공유 상태 + 헬퍼
import './shared';
import './fiber-helpers';
import './state-hooks';
import './state-change-tracking'; // onCommitFiberRoot 래핑 (state-hooks 이후)
import './query-selector';
import './screen-offset';
import './fiber-serialization';

// Phase 3: MCP 메서드 모듈
import './mcp-registration';
import './mcp-introspection';
import './mcp-actions';
import './mcp-webview';
import './mcp-scroll';
import './mcp-console';
import './mcp-network';
import './mcp-state';
import './mcp-query';
import './mcp-measure';
import './mcp-accessibility';

// Phase 4: MCP 객체 조립 + global 할당
import './mcp-object';

// Phase 5: monkey-patch
import './console-hook';
import './network-helpers';
import './xhr-patch';
import './fetch-patch';

// Phase 6: WebSocket 연결 (마지막)
import './connection';
