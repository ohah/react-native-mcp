# 아키텍처

React Native MCP의 내부 동작 원리를 설명합니다.

---

## 개요

React Native MCP는 AI 도구(Cursor, Claude Desktop, Copilot)가 React Native 앱을 제어하고 검사할 수 있게 합니다. React Native에는 DOM이 없으므로 **React Fiber 트리**, **Babel 코드 주입**, **네이티브 CLI 도구**(adb/idb)를 활용합니다.

### 브라우저(DOM) MCP와의 비교

| 항목      | 브라우저(DOM) MCP     | React Native MCP                                    |
| --------- | --------------------- | --------------------------------------------------- |
| 트리      | DOM tree              | React Fiber tree                                    |
| 선택자    | CSS selector          | testID, querySelector (Fiber 셀렉터)                |
| 조작      | querySelector + click | Fiber + 네이티브 터치 주입 (tap/swipe)              |
| 스냅샷    | HTML snapshot         | 컴포넌트 트리 JSON                                  |
| 스크린샷  | 브라우저 DevTools API | adb / xcrun simctl (호스트 CLI, 네이티브 모듈 없음) |
| 통신      | WebSocket (DevTools)  | WebSocket + eval                                    |
| 코드 주입 | 불필요                | Babel/Metro 필수                                    |

---

## 3계층 아키텍처

```
┌──────────────────────────────────────────────┐
│  AI 클라이언트 (Cursor / Claude / Copilot)   │
└─────────────────────┬────────────────────────┘
                      │ stdio (MCP 프로토콜)
┌─────────────────────▼────────────────────────┐
│  MCP 서버 (Node.js)                          │
│  - 42개 MCP 도구                             │
│  - WebSocket 서버 (ws://localhost:12300)      │
│  - 네이티브 CLI 브릿지 (adb / idb)           │
└──────┬──────────────────────────┬────────────┘
       │ WebSocket (12300)        │ adb/idb CLI
┌──────▼──────┐            ┌─────▼──────┐
│  앱 런타임   │            │  시뮬레이터 │
│  (in-app JS) │            │  / 디바이스 │
└─────────────┘            └────────────┘
```

### 1계층: AI 클라이언트

AI 클라이언트(Cursor, Claude Desktop, Copilot CLI)는 **stdio**를 통해 MCP 프로토콜로 MCP 서버와 통신합니다. 도구 호출을 보내고 결과를 받으며, React Native 내부에 대해서는 알 필요가 없습니다.

### 2계층: MCP 서버

Node.js 프로세스로 다음을 수행합니다:

- 12개 카테고리에 걸친 **42개 MCP 도구** 제공 (인터랙션, 검증, 화면 캡처, 네트워크 모킹, 상태 인스펙션, 렌더 프로파일링 등)
- 앱과의 양방향 통신을 위한 **WebSocket 서버** (포트 12300)
- 스크린샷, 탭, 스와이프, 텍스트 입력을 위한 **네이티브 CLI 명령** 실행 (Android는 adb, iOS 시뮬레이터는 idb)

### 3계층: 앱 런타임 + 네이티브 도구

- **런타임** (`runtime.js`): Babel 프리셋이 앱 번들에 주입하는 순수 JavaScript. `ws://localhost:12300`에 연결하고, Fiber 트리를 노출하며, eval 요청을 처리하고, 네트워크/콘솔을 인터셉트하고, 상태 변경을 추적합니다.
- **네이티브 도구**: 스크린샷과 터치 주입은 호스트 CLI 도구(`adb exec-out screencap`, `xcrun simctl io screenshot`, `idb ui tap`)를 사용하므로, **앱에 네이티브 모듈을 설치할 필요가 없습니다**.

---

## 통신 흐름

### 디바이스 등록

```
앱 시작
  → runtime.js가 ws://localhost:12300에 연결
  → { type: 'init', platform, deviceName, metroBaseUrl } 전송
  → 서버가 deviceId 할당 (예: 'ios-1', 'android-1')
  → appConnected가 true로 변경
```

### 도구 실행

```
AI 클라이언트가 도구 호출 (예: "take_snapshot")
  → MCP 서버가 stdio로 수신
  → 서버가 WebSocket으로 앱에 요청 전송
  → 앱 런타임이 Fiber 트리를 순회하여 컴포넌트 트리 JSON 반환
  → 서버가 stdio로 AI 클라이언트에 결과 반환
```

### 멀티 디바이스 지원

```
┌─────────────────────────────────────────────┐
│  MCP 서버                                   │
│  WebSocket 서버 (ws://localhost:12300)       │
└──────┬──────────┬───────────┬───────────────┘
       │          │           │  WebSocket
┌──────▼───┐ ┌───▼────┐ ┌───▼─────┐
│ ios-1    │ │ ios-2  │ │android-1│  ...N대
│ iPhone15 │ │iPad Pro│ │ Pixel 7 │
└──────────┘ └────────┘ └─────────┘
```

모든 도구는 선택적 `deviceId`와 `platform` 파라미터를 지원합니다:

- `deviceId` 지정 → 해당 디바이스로 라우팅
- `platform` 지정 + 1대 → 자동 선택
- 전체 1대만 → 자동 선택 (하위 호환)
- 여러 대 + 미지정 → 에러 (`deviceId` 지정 필요)

---

## 빌드 파이프라인

### Babel 프리셋 동작

Babel 프리셋(`@ohah/react-native-mcp-server/babel-preset`)은 빌드 시 두 가지를 수행합니다:

1. **testID 자동 주입**: 컴포넌트에 `testID` props를 추가하여 안정적인 요소 선택 가능
2. **AppRegistry 래핑**: `AppRegistry.registerComponent`를 래핑하여 런타임 주입

```
소스 코드
  ↓ Babel 프리셋 (testID 주입, AppRegistry 래핑)
  ↓ Metro 번들러
  ↓
번들 (런타임 + Babel 변환 포함)
  ↓
앱 실행 → 런타임이 __DEV__ 감지 → WebSocket 자동 연결 → MCP 준비 완료
```

프로덕션 빌드에서는 런타임이 포함되지만, Metro 실행 시 `REACT_NATIVE_MCP_ENABLED=true`를 설정하지 않으면 연결하지 않습니다.

---

## 도구 카테고리별 데이터 흐름

| 카테고리          | 예시                                        | 데이터 경로                        |
| ----------------- | ------------------------------------------- | ---------------------------------- |
| **스냅샷 / 쿼리** | `take_snapshot`, `query_selector`           | WebSocket → Fiber 트리 순회 → JSON |
| **인터랙션**      | `tap`, `swipe`, `input_text`                | 네이티브 CLI (adb/idb) → 디바이스  |
| **검증**          | `assert_text`, `assert_visible`             | WebSocket → Fiber 트리 확인        |
| **스크린샷**      | `take_screenshot`                           | 네이티브 CLI → PNG 파일            |
| **상태**          | `inspect_state`, `get_state_changes`        | WebSocket → React hooks 검사       |
| **네트워크**      | `list_network_requests`, `set_network_mock` | WebSocket → XHR/fetch 인터셉트     |
| **콘솔**          | `list_console_messages`                     | WebSocket → console 인터셉트       |
| **렌더**          | `start_render_profile`, `get_render_report` | WebSocket → 렌더 추적              |
| **실행**          | `evaluate_script`                           | WebSocket → 앱 내 JS eval          |
| **WebView**       | `webview_evaluate_script`                   | WebSocket → WebView JS 브릿지      |
| **디바이스**      | `list_devices`, `set_location`              | 네이티브 CLI                       |
| **파일**          | `file_push`, `add_media`                    | 네이티브 CLI                       |

---

## 포트 사용

| 포트              | 용도                                                |
| ----------------- | --------------------------------------------------- |
| **12300**         | MCP 서버 WebSocket — 앱 런타임이 여기에 연결        |
| **8081** (기본값) | Metro 번들러 (또는 커스텀 포트, 예: 데모 앱은 8230) |

MCP 서버는 Metro의 포트나 설정을 변경하지 않습니다. 독립적으로 실행되며, 앱 런타임은 Metro(번들링)와 MCP 서버(도구 통신) 양쪽 모두에 연결합니다.

---

## 패키지 구조

단순성을 위해 하나의 패키지에 모든 것이 포함되어 있습니다:

```
packages/react-native-mcp-server/
├── src/
│   ├── index.ts                 # CLI 진입점 + MCP 서버 (stdio)
│   ├── websocket-server.ts      # WebSocket 서버 (멀티 디바이스, 12300)
│   ├── tools/                   # 42개 MCP 도구 구현
│   ├── babel/                   # Babel 프리셋 (testID 주입)
│   ├── metro/                   # Metro transformer
│   └── runtime/                 # 런타임 소스 (runtime.js로 컴파일)
├── runtime.js                   # 앱 주입 런타임 (생성됨, 직접 편집 금지)
├── babel-preset.js              # Babel 프리셋 진입점
└── metro-transformer.cjs        # Metro transformer 진입점
```
