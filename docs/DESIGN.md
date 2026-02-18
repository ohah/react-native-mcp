# React Native MCP 서버 설계 문서

React Native 앱 자동화·모니터링을 위한 MCP 서버 설계. Chrome DevTools MCP와 유사하지만 DOM이 없는 React Native 환경에 맞춰 Metro + Babel + Fiber tree 기반으로 구축.

---

## 1. 개요

### 1.1 목표

React Native 앱을 AI가 제어하고 모니터링할 수 있도록 MCP 서버 구축:

- **컴포넌트 조회**: DOM 대신 React Fiber tree 활용
- **자동화**: testID 기반 컴포넌트 선택 및 조작
- **모니터링**: 네트워크, 로그, 상태 추적
- **시각적 피드백**: CLI 기반 스크린샷 (ADB / simctl, 앱 내 네이티브 모듈 없음)

### 1.2 Chrome MCP와의 차이점

| 항목      | Chrome MCP            | React Native MCP                                 |
| --------- | --------------------- | ------------------------------------------------ |
| 구조 파악 | DOM tree              | React Fiber tree                                 |
| 선택자    | CSS selector          | testID, querySelector (Fiber 셀렉터)             |
| 조작      | querySelector + click | Fiber + 네이티브 터치 주입 (tap/swipe)           |
| 스냅샷    | HTML snapshot         | Component tree JSON                              |
| 스크린샷  | CDP screenshot        | ADB / xcrun simctl (호스트 CLI, 앱 내 모듈 없음) |
| 통신      | CDP (WebSocket)       | WebSocket + eval                                 |
| 코드 주입 | 불필요                | Babel/Metro 필수                                 |

### 1.3 핵심 전략

1. **Metro 번들러**: 컴포넌트 구조 파악 및 런타임 코드 자동 주입
2. **Babel Plugin**: AST 변환으로 testID·ref·onPress 래핑 코드 주입
3. **React Fiber Hook**: 런타임 컴포넌트 트리 추적 (React DevTools 방식)
4. **WebSocket**: MCP 서버 ↔ 앱 양방향 통신
5. **스크린샷**: 네이티브 모듈 없이 호스트에서 ADB(Android)·simctl(iOS 시뮬레이터)로 캡처

---

## 2. 기술적 가능성 분석

### 2.1 ✅ 확실히 가능한 부분

#### Metro Plugin

- Metro는 `transformer`, `serializer`, `resolver` 커스터마이징 지원
- `metro.config.js`로 플러그인 추가
- 런타임 코드 자동 번들링
- **참고**: Flipper Metro 플러그인

#### Babel Plugin

- AST 변환으로 컴포넌트 코드 주입 (testID, ref, onPress 래핑)
- 프로덕션 빌드에서도 Babel 변환은 적용됨 (runtime WebSocket만 `__DEV__` 체크)
- 자동 testID 생성 및 삽입
- **참고**: react-native-reanimated (worklet 주입 패턴)

#### WebSocket + HMR

- Metro는 이미 `ws://localhost:8230`으로 HMR 제공 (demo-app 기본 포트)
- 별도 WebSocket 서버 추가 가능
- 양방향 통신으로 명령 전송 및 결과 수신

#### Remote Code Execution

- `eval()` 지원 (개발 모드)
- Metro HMR이 유사 방식 사용
- Chrome DevTools Protocol도 remote execution 가능

#### 스크린샷 (CLI 기반, 네이티브 모듈 없음)

- **Android**: `adb exec-out screencap -p` — OS가 화면 덤프, PTY 손상 없이 raw PNG 수신
- **iOS 시뮬레이터**: `xcrun simctl io booted screenshot <path>` — 시뮬레이터만 지원, 실기기는 미지원
- 앱에 네이티브 모듈을 설치하지 않아도 되며, MCP 서버가 호스트에서 위 명령을 실행해 캡처

### 2.2 ⚠️ 어려운 부분 (해결 가능)

#### Component Tree 파악

**문제**: DOM이 없어서 `querySelector` 불가

**해결책**:

- React Fiber tree 활용
- `__REACT_DEVTOOLS_GLOBAL_HOOK__` 패턴
- `fiber.child`, `fiber.sibling`으로 순회
- **참고**: react-devtools-shared/src/backend/

#### 컴포넌트 선택/조작

**문제**: CSS selector가 없음

**해결책**:

- testID 기반 선택
- Babel로 자동 testID 주입
- displayName + props 조합 매칭
- XPath 스타일: `/App/Screen[0]/Button[name="Submit"]`

#### ScrollView/FlatList 가상화

**문제**: 미렌더링 요소 접근 불가

**현재 구현**:

- Babel이 ScrollView/FlatList에 `registerScrollRef` 자동 주입
- 네이티브 `swipe` 도구로 수동 스크롤 → 렌더링된 항목을 `query_selector_all`로 조회
- 자동화된 전체 목록 탐색은 미구현

#### Modal/Overlay 추적 ✅

RN의 Modal은 JS 컴포넌트이므로 Fiber 트리에 포함됨. 기존 도구(take_snapshot, query_selector, tap 등)로 별도 처리 없이 동작.

### 2.3 난이도

**전체 난이도**: ⭐⭐⭐⭐☆ (5점 만점에 4점)

**점진적 구현 가능**: Phase 1부터 단계적으로 동작

### 2.4 Metro AST 변환 검증 (CLI)

실제 앱·Metro 서버를 띄우지 않고 **CLI 단위 테스트**로 AST 기반 코드 감싸기를 검증할 수 있다.

- **위치**: `packages/react-native-mcp-server/src/metro/transform-source.ts`, `src/__tests__/metro-transformer.test.ts`
- **동작**: Metro 의존성 없이, **Metro에 붙일 변환 함수**(`transformSource`)만 Babel로 구현해 두고, 테스트에서 이 함수를 직접 호출해 입력 문자열 → 변환 결과를 assert한다. `AppRegistry.registerComponent(...)` 를 `__REACT_NATIVE_MCP__.registerComponent(...)` 로 치환하는지 검증.
- **실행** (레포 루트 또는 패키지 디렉터리):
  ```bash
  cd packages/react-native-mcp-server && bun test src/
  ```
- **확장**: `metro`는 이미 devDependency에 포함되어 있음. 나중에 `Metro.runBuild()` 로 진짜 번들 출력을 검증하는 통합 테스트 추가 시 사용할 예정.

---

## 3. 아키텍처

### 3.1 패키지 구조

**현재**: 서버·transformer·런타임이 `react-native-mcp-server` 한 패키지에 통합됨.

```
react-native-mcp/
├── packages/
│   └── react-native-mcp-server/   # MCP 서버 + Metro transformer + Babel(inject-testid) + runtime
│       ├── src/ (index, websocket-server, tools/eval-code, babel/inject-testid, metro/transform-source)
│       ├── runtime.js              # 앱 주입 런타임
│       └── metro-transformer.cjs   # 앱 Metro에서 사용
├── examples/
│   └── demo-app/                   # 테스트용 RN 앱 (7탭: Scroll/Press/Input/List/WebView/Network/Gesture)
└── docs/
    └── DESIGN.md
```

(향후 분리 가능: metro-plugin, babel-plugin, runtime, native-snapshot)

### 3.2 데이터 흐름 (Multi-Device)

```
┌─────────────────────────────────────────────────┐
│  Cursor / Claude Desktop / Copilot CLI          │
└───────────────────┬─────────────────────────────┘
                    │ stdio (MCP protocol)
┌───────────────────▼─────────────────────────────┐
│  MCP Server                                     │
│  - Tools: evaluate_script, query_selector, etc. │
│  - WebSocket Server (ws://localhost:12300)      │
│  - 모든 도구에 deviceId/platform 파라미터 지원   │
└──────┬──────────┬───────────┬───────────────────┘
       │          │           │  WebSocket (12300)
┌──────▼───┐ ┌───▼────┐ ┌───▼─────┐
│ ios-1    │ │ ios-2  │ │android-1│  ...N대
│ iPhone15 │ │iPad Pro│ │ Pixel 7 │
└──────────┘ └────────┘ └─────────┘

라우팅: resolveDevice(deviceId?, platform?)
  - deviceId 지정 → 해당 디바이스
  - platform 지정 + 1대 → 자동 선택
  - platform 지정 + 2대+ → 에러 (deviceId 지정 필요)
  - 미지정 + 전체 1대 → 자동 선택 (기존 호환)
  - 미지정 + 전체 2대+ → 에러

스크린샷 (호스트 CLI):
  adb exec-out screencap (Android) / xcrun simctl io (iOS 시뮬레이터)
```

**디바이스 등록 흐름**: 앱 시작 → runtime.js가 ws://localhost:12300에 연결 → `{ type: 'init', platform, deviceName, metroBaseUrl }` 전송 → 서버가 내부적으로 deviceId 할당 (`{platform}-{순번}`) → 이후 해당 WebSocket의 모든 요청/응답은 deviceId로 라우팅

**재연결**: 서버는 매번 새 deviceId를 할당. 클라이언트(runtime.js)는 연결 끊길 시 지수 백오프(최대 30초)로 재접속 시도

### 3.3 빌드 파이프라인

```
개발 모드:
Source Code
  ↓ Babel Plugin (testID, ref 주입, onPress 래핑 — 항상 적용)
  ↓ Metro Transformer (runtime 자동 번들링)
  ↓
Bundle (with runtime + Babel 변환)
  ↓
App 실행 → runtime이 __DEV__ 감지 → WebSocket 자동 연결 → MCP 제어 가능

프로덕션 빌드:
Source Code
  ↓ Babel Plugin (testID, ref 주입 — 동일하게 적용)
  ↓ Metro Transformer (runtime 포함되나 WebSocket 미연결)
  ↓
Bundle (Babel 변환 포함, runtime 포함)
  ↓
App 실행 → __DEV__=false → WebSocket 미연결 (REACT_NATIVE_MCP_ENABLED로 Metro 실행 시 또는 MCP.enable() 수동 활성화)
```

---

## 4. 패키지 상세 스펙

### 4.1 packages/react-native-mcp-server (서버 역할)

**역할**: MCP 프로토콜 서버 + WebSocket 서버 + Metro transformer + Babel 변환 + 런타임

**의존성**:

- `@modelcontextprotocol/sdk` - MCP 서버/트랜스포트
- `ws` - WebSocket 서버
- `zod` - 파라미터 검증

**주요 파일**:

```
packages/react-native-mcp-server/
├── src/
│   ├── index.ts                 # 진입점 (stdio transport)
│   ├── websocket-server.ts      # WS 서버 (다중 디바이스, 12300)
│   ├── tools/
│   │   ├── index.ts             # 도구 등록
│   │   └── eval-code.ts         # evaluate_script ✅
│   ├── babel/
│   │   └── inject-testid.ts     # testID 자동 주입 + registerPressHandler 주입 ✅
│   ├── metro/
│   │   └── transform-source.ts  # 진입점 runtime 주입 + registerComponent 래핑 ✅
│   └── transformer-entry.ts    # Metro에서 로드하는 진입점
├── runtime.js                   # 앱에 주입되는 런타임 (WebSocket, eval, Fiber 트리, WebView, Scroll) ✅
├── metro-transformer.cjs        # Metro babelTransformerPath
└── scripts/
    └── chmod-dist.mjs           # 빌드 후 실행 권한
```

**제공 Tools** (모든 도구에 `deviceId`, `platform` 파라미터 지원):

**앱 런타임 도구** (WebSocket을 통해 앱 내에서 실행):

- `evaluate_script` - 앱 컨텍스트에서 JS 함수 실행 ✅
- `webview_evaluate_script` - 앱 내 WebView에서 임의 JS 실행 (injectJavaScript) ✅
- `take_snapshot` - React Fiber 트리 스냅샷 (컴포넌트 구조 JSON) ✅
- `type_text` - TextInput에 텍스트 입력 (onChangeText + setNativeProps). 유니코드/한글 지원 ✅
- `query_selector` - Fiber 셀렉터로 첫 번째 매칭 요소 검색 (CSS querySelector 유사) ✅
- `query_selector_all` - Fiber 셀렉터로 모든 매칭 요소 검색 ✅
- `accessibility_audit` - Fiber 트리 순회로 접근성 규칙 위반 검출 (pressable-needs-label, image-needs-alt, touch-target-size, missing-role) ✅
- `assert_text` - 텍스트 존재 여부 확인 ({ pass, message } 반환). `timeoutMs`/`intervalMs` 옵션으로 polling 대기 지원 ✅ (polling: 예정)
- `assert_visible` - 셀렉터 매칭 요소 존재 여부 확인 ({ pass, message } 반환). `timeoutMs`/`intervalMs` 옵션으로 polling 대기 지원 ✅ (polling: 예정)
- `assert_not_visible` - 셀렉터 매칭 요소가 사라졌는지 확인. `timeoutMs`/`intervalMs` 옵션으로 polling 대기 지원 (예정)
- `assert_element_count` - 셀렉터 매칭 요소 개수 확인. `expected_count`/`min_count`/`max_count` 지원 (예정)
- `scroll_until_visible` - 요소가 보일 때까지 자동 스크롤. `direction`/`max_scrolls`/`scrollable_selector` 지원 (예정)
- `get_debugger_status` - 앱 연결 상태 + 디바이스 목록 ✅
- `list_console_messages` - nativeLoggingHook 기반 콘솔 로그 조회 (level/since/limit 필터) ✅
- `clear_console_messages` - 콘솔 로그 버퍼 초기화 ✅
- `list_network_requests` - XHR/fetch monkey-patch 기반 네트워크 요청 조회 (url/method/status/since/limit 필터) ✅
- `clear_network_requests` - 네트워크 요청 버퍼 초기화 ✅

**네이티브 도구** (호스트 CLI에서 실행, `platform` 파라미터로 iOS/Android 통합):

- `take_screenshot` - ADB(Android) / simctl(iOS 시뮬레이터)로 캡처 ✅
- `tap` - 좌표 탭 + 롱프레스 (duration 파라미터). iOS: points, Android: pixels ✅
- `swipe` - 좌표 스와이프. 드로워/바텀시트/페이저 등 네이티브 제스처 ✅
- `input_text` - 포커스된 입력 필드에 텍스트 입력 (ASCII만, 한글은 type_text 사용) ✅
- `input_key` - 키코드 전송. iOS: HID, Android: keyevent ✅
- `press_button` - 물리 버튼 (HOME, BACK 등) ✅
- `describe_ui` - UI 트리/접근성 트리 조회 ✅
- `file_push` - 파일 전송 ✅
- `add_media` - 미디어 파일 추가 (사진첩) ✅
- `list_devices` - 연결된 시뮬레이터/디바이스 목록 ✅
- `switch_keyboard` - 키보드 언어 전환 ✅
- `open_deeplink` - 딥링크 열기 ✅

> **앱 생명주기(launch/terminate/deeplink)**: 별도 MCP 도구 대신 **MCP Resource** (`docs://guides/app-lifecycle`)로 가이드 제공. AI 에이전트가 리소스를 읽고 기존 Bash 도구로 실행. 상세: 섹션 15.

**삭제된 Tools**:

- `click` / `click_by_label` - 네이티브 `tap` 도구로 대체 (실제 터치 파이프라인)
- `long_press` / `long_press_by_label` - 네이티브 `tap(duration)` 도구로 대체
- `scroll` - 네이티브 `swipe` 도구로 대체 (실제 스크롤 제스처)
- `list_clickables` - `query_selector_all(':has-press')`로 대체
- `list_text_nodes` - `query_selector_all('Text')`로 대체
- `list_pages` - RN은 단일 앱이라 불필요
- `click_webview` - `webview_evaluate_script`로 대체 (CSS selector 클릭만 가능 → 임의 JS 실행)
- `navigate_webview` - `webview_evaluate_script`로 대체 (`window.location.href = url`로 동일 동작)
- `get_by_label` / `get_by_labels` - `query_selector`로 대체
- `list_clickable_text_content` - `query_selector_all`로 대체
- `get_console_message` - CDP 기반 단건 조회. `list_console_messages`의 필터 옵션으로 대체
- `get_network_request` - CDP 기반 단건 조회. `list_network_requests`의 필터 옵션으로 대체
- `idb_*` / `adb_*` (18개) - `platform` 파라미터를 가진 통합 도구 9개로 병합 (tap, swipe, input_text, input_key, press_button, describe_ui, file_push, add_media, list_devices)

### 4.2 Babel Plugin (inject-testid.ts)

> 별도 패키지 없음. `packages/react-native-mcp-server/src/babel/inject-testid.ts`에 통합.

**활성 기능** (개발/프로덕션 모두 적용):

1. **자동 testID**: JSX 요소에 `ComponentName-index-TagName` 형식 ID 주입
2. **displayName 주입**: PascalCase 함수 컴포넌트에 `.displayName` 자동 설정 (Release Fiber 트리 이름 보존)
3. **WebView ref 주입**: testID가 있으면 `registerWebView`/`unregisterWebView` 자동 주입 (Fiber 대체 불가)
4. **WebView onMessage 주입**: testID 있는 WebView에 `onMessage` 자동 설정 — 사용자 `onMessage`가 있으면 `createWebViewOnMessage(사용자핸들러)`로 감싸서 MCP 결과 수신과 사용자 postMessage 공존, 없으면 `(e) => handleWebViewMessage(e.nativeEvent.data)`만 주입. 앱에 MCP 전용 코드 불필요.
5. **동적 testID 지원**: TemplateLiteral, 변수 참조 등 동적 표현식 처리

**비활성화된 기능** (`inject-testid.ts`의 플래그로 제어):

- `INJECT_PRESS_HANDLER = false` — onPress `registerPressHandler` 래핑
  - 네이티브 `tap` 도구로 터치 주입 가능 (Fiber props 호출 불필요)
  - 재활성화: `INJECT_PRESS_HANDLER = true`로 변경
- `INJECT_SCROLL_REF = false` — ScrollView/FlatList `registerScrollRef` ref 주입
  - Fiber `stateNode.scrollTo()` / `scrollToOffset()`로 직접 접근 가능
  - 재활성화: `INJECT_SCROLL_REF = true`로 변경
  - **주의**: ScrollView/FlatList가 class→function component로 전환되면 `stateNode=null`이 되므로 재활성화 필요

> **WebView만 Babel 주입이 필수인 이유**: `react-native-webview`의 WebView는 `forwardRef` 기반 function component라 Fiber `stateNode`가 `null`. `injectJavaScript`는 ref callback으로만 접근 가능.

**변환 예시**:

```jsx
// Before (원본 코드)
function MyButton({ title, onPress }) {
  return (
    <TouchableOpacity testID="my-btn" onPress={onPress}>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}

// After (Babel 변환 후 — 개발/프로덕션 동일)
MyButton.displayName = 'MyButton';
function MyButton({ title, onPress }) {
  return (
    <TouchableOpacity testID="my-btn" onPress={onPress}>
      <Text testID="MyButton-0-Text">{title}</Text>
    </TouchableOpacity>
  );
}
// onPress는 래핑되지 않음 (INJECT_PRESS_HANDLER=false)
// Fiber memoizedProps.onPress()로 직접 호출
```

### 4.3 Runtime (runtime.js)

> 별도 패키지 없음. `packages/react-native-mcp-server/runtime.js` 단일 파일.

**구성** (하나의 파일에 모두 포함):

1. **DevTools hook 설치**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` 없으면 자동 생성 (Release 빌드 Fiber 접근)
2. **Fiber 트리 헬퍼**: `getFiberRoot`, `collectText`, `getLabel`, `getFiberTypeName`, `getComponentTree` 등
3. **Press**: `triggerPress` (Fiber memoizedProps.onPress 직접 호출), `pressByLabel` (텍스트 매칭)
4. **Long Press**: `triggerLongPress` (Fiber memoizedProps.onLongPress 직접 호출), `longPressByLabel` (텍스트 매칭)
5. **Text Input**: `typeText` (onChangeText 호출 + setNativeProps 네이티브 값 동기화)
6. **Scroll**: Fiber `stateNode.scrollTo()` 직접 접근. `registerScrollRef` 레지스트리 fallback 유지
7. **querySelector**: `querySelector`/`querySelectorAll` — CSS querySelector 유사 Fiber 셀렉터 (타입, #testID, :text(), [attr], :has-press, :has-scroll, 계층 셀렉터, 콤마 OR). 동일 testID 중복 제거(dedup) 포함
8. **WebView**: `registerWebView`, `unregisterWebView`, `evaluateInWebView` (Babel 주입 필수 — Fiber 대체 불가)
9. **콘솔 로그 캡처**: `nativeLoggingHook` 체이닝으로 콘솔 출력 버퍼링 (최대 500개). `getConsoleLogs(options)` / `clearConsoleLogs()`. level 맵핑: 0=log, 1=info, 2=warn, 3=error
10. **네트워크 요청 캡처**: `XMLHttpRequest.prototype` + `fetch` monkey-patch로 네트워크 요청 버퍼링 (최대 200개, body 최대 10000자). `getNetworkRequests(options)` / `clearNetworkRequests()`. 필터: url(substring), method(정확), status(정확), since(timestamp), limit(기본 50)
11. **WebSocket 연결**: `__DEV__` 자동 연결, Release는 `REACT_NATIVE_MCP_ENABLED`(빌드 시) 또는 `MCP.enable()` 수동 활성화, 지수 백오프 재연결 (최대 30초)

> runtime.js의 레거시 함수(registerPressHandler, registerScrollRef 등)는 코드가 유지되어 있으나,
> Babel 플래그 비활성화로 호출되지 않음. Babel 플래그 재활성화 시 즉시 동작.
>
> **삭제된 함수**: `getByLabel`, `getByLabels`, `getClickableTextContent` — `querySelector`로 대체되어 런타임에서 제거됨.

**WebSocket 연결 조건**:

- `__DEV__ === true` → 자동 연결
- `__DEV__ === false` → Metro 실행 시 `REACT_NATIVE_MCP_ENABLED=true` 로 주입된 플래그 또는 `MCP.enable()` 호출 시 수동 연결
- `runApplication` 시점에 미연결이면 재시도
- 5초 주기 재시도 (MCP 서버가 나중에 뜨는 경우 대응)

### 4.4 스크린샷 (CLI 기반, 네이티브 모듈 없음)

**역할**: 호스트(MCP 서버 실행 환경)에서 ADB / simctl로 화면 캡처. 앱 내 네이티브 모듈은 사용하지 않음.

**Android**:

- `adb exec-out screencap -p` — stdout으로 raw PNG 출력 (`shell` 대신 `exec-out`으로 PTY 바이너리 손상 방지)
- PNG 시그니처 검증 후 Base64 인코딩 → MCP 응답 반환

**iOS (시뮬레이터만)**:

- `xcrun simctl io booted screenshot <path>` — 파일로 저장 후 읽어 Base64 반환
- `simctl`은 시뮬레이터 전용. 실기기 연결 시에는 사용 불가

**플랫폼 선택**:

- `take_screenshot` 도구에서 `platform` 인자로 `android` | `ios` 지정, 또는 자동 감지(adb devices / simctl list Booted)

---

## 5. 구현 단계 (Phase별)

**현재 구현 상태**: 서버·Metro transformer·Babel 변환·런타임이 `packages/react-native-mcp-server` 한 패키지에 통합되어 있음. 별도 metro-plugin / babel-plugin / runtime 패키지는 없음.

### Phase 1: 기본 인프라 ✨ (MVP)

**목표**: WebSocket + eval로 기본 제어 가능

**구현**:

- [x] MCP 서버 기본 구조
  - [x] stdio transport 구현
  - [x] WebSocket 서버 추가 (ws://localhost:12300)
  - [x] 기본 도구 1개: `evaluate_script`
- [x] Runtime (runtime.js, 서버 패키지 내)
  - [x] WebSocket 클라이언트
  - [x] eval bridge 구현
  - [x] `__DEV__` 플래그 처리
- [x] Metro Transformer (서버 패키지 내 metro-transformer.cjs)
  - [x] runtime 자동 주입 (진입점에 require + registerComponent 래핑)
  - [ ] HMR 통합 (미구현, MCP 전용 WebSocket 12300 사용)

- [x] 테스트
  - [x] 데모 앱 생성 (examples/demo-app)
  - [x] MCP로 코드 실행 확인

**산출물**: AI가 앱에서 임의 코드 실행 가능 ✅

### Phase 2: Component Tree 읽기 ✅

**목표**: 컴포넌트 구조 파악

**구현**:

- [x] Fiber Hook 구현
  - [x] `__REACT_DEVTOOLS_GLOBAL_HOOK__` 패턴 — runtime.js에서 hook 없으면 자동 설치 (Release 빌드 지원)
  - [x] Fiber tree 순회 함수 (`getFiberRoot`, `collectText`, `getLabel`, `getFiberTypeName` 등)
  - [x] 컴포넌트 정보 직렬화 (`getComponentTree` → uid, type, testID, accessibilityLabel, text, children)
- [x] MCP Tools 추가
  - [x] `take_snapshot` - Fiber 트리 기반 컴포넌트 트리 JSON ✅
  - [x] ~~`list_text_nodes`~~ - `query_selector_all('Text')`로 대체 후 삭제
  - [x] ~~`list_clickables`~~ - `query_selector_all(':has-press')`로 대체 후 삭제
  - [x] ~~`get_by_label`~~ - `query_selector`로 대체 후 삭제
- [ ] Metro Plugin 확장
  - [ ] 컴포넌트 메타데이터 수집
  - [ ] 소스맵 연동

**산출물**: AI가 렌더링된 컴포넌트 목록 조회 ✅

### Phase 3: Babel 코드 주입

**목표**: 자동 testID 및 추적 코드

**구현**:

- [x] Babel 변환 (서버 패키지 내 inject-testid.ts, Metro transformer에서 호출)
  - [x] AST visitor 구현
  - [x] 컴포넌트 감지 (JSX)
  - [x] testID 자동 생성 및 주입
  - [x] PascalCase 컴포넌트에 displayName 자동 주입 (Release 빌드에서 Fiber 트리 이름 보존)
  - [x] ~~ScrollView/FlatList ref → `registerScrollRef` 자동 주입~~ (비활성화됨, `INJECT_SCROLL_REF = false`. 네이티브 `swipe` 도구로 대체)
  - [x] WebView ref + testID → `registerWebView` 자동 주입 (webview_evaluate_script 도구)
  - [ ] 추적 코드 삽입 (미구현)
- [x] 프로덕션 처리
  - [x] Babel 변환은 항상 적용 (testID, ref, onPress 래핑)
  - [x] runtime은 `__DEV__` 체크 → false이면 WebSocket 미연결 (`REACT_NATIVE_MCP_ENABLED` 또는 `MCP.enable()`으로 활성화)
  - [ ] Dead code elimination 검증 (미검증)
- [x] MCP 조작 (evaluate_script로 구현)
  - [x] testID로 onPress 트리거 → 네이티브 `tap` 도구로 대체 (실제 터치 파이프라인)
  - [x] 스크롤 → 네이티브 `swipe` 도구로 대체 (실제 스크롤 제스처)
  - [x] webview_evaluate_script 도구 — WebView 내 임의 JS 실행. 실행 결과 피드백: **Babel이 testID 있는 WebView에 onMessage 자동 주입** (사용자 onMessage 있으면 createWebViewOnMessage로 감쌈, 없으면 handleWebViewMessage만). 앱에 MCP 전용 코드 불필요.

**산출물**: AI가 컴포넌트 선택 및 조작 (버튼 클릭 등) ✅

### Phase 4: CLI 스크린샷 (ADB / simctl) ✅

**목표**: 시각적 피드백. 네이티브 모듈 없이 호스트 CLI로 캡처.

**구현**:

- [x] MCP Tool 추가
  - [x] `take_screenshot` — Android: `adb exec-out screencap -p`, iOS 시뮬레이터: `xcrun simctl io booted screenshot`
  - [x] Base64 PNG 반환 (data URL 또는 content)
- [ ] 선택: 압축/크기 조절 (미구현)

**산출물**: AI가 화면 보고 판단 (Android 기기 또는 iOS 시뮬레이터) ✅

### Phase 5: 고급 기능

**목표**: Modal, FlatList, 네트워크/콘솔 모니터링 등

**구현**:

- [x] Modal — React Fiber 트리에 포함되므로 기존 도구(take_snapshot, query_selector, tap 등)로 별도 처리 없이 동작
- [x] FlatList/ScrollView — 네이티브 `swipe` 도구로 수동 스크롤 후 `query_selector_all`로 조회·탭 가능 (자동화된 가상화 탐색은 미구현)
- [x] 네트워크 모니터링 — XHR/fetch monkey-patch로 네트워크 요청 캡처 (`list_network_requests`, `clear_network_requests`) ✅
- [x] 콘솔 모니터링 — `nativeLoggingHook` 체이닝으로 콘솔 로그 캡처 (`list_console_messages`, `clear_console_messages`) ✅
- [x] 연결 상태 + 디바이스 목록 확인 (`get_debugger_status`) ✅
- [x] Fiber 트리 기반 셀렉터 (`query_selector`, `query_selector_all`) — CSS 유사 Fiber 셀렉터 ✅
- [x] 다중 디바이스 지원 — N대 동시 연결, deviceId/platform 기반 라우팅 ✅
- [x] 네이티브 터치 도구 — `tap`(+롱프레스), `swipe`, `input_text`, `input_key`, `press_button` ✅
- [x] type_text — TextInput 텍스트 입력 (onChangeText + setNativeProps) ✅
- [ ] 성능 모니터링

**산출물**: 프로덕션급 완성

---

## 6. Fiber 직접 접근 vs Babel 주입 분석

### 6.1 검증 결과

`evaluate_script`로 Fiber 트리에서 직접 조작이 가능한지 검증한 결과:

| 동작                   | Fiber 직접 접근 | 방법                                                                     |
| ---------------------- | --------------- | ------------------------------------------------------------------------ |
| ScrollView 스크롤      | **가능**        | `fiber.stateNode.scrollTo({y: 300})` (class component, tag:1)            |
| FlatList 스크롤        | **가능**        | `fiber.stateNode.scrollToOffset({offset: 500})` (class component, tag:1) |
| FlatList scrollToIndex | **가능**        | `fiber.stateNode.scrollToIndex({index: 5})`                              |
| 버튼 클릭 (onPress)    | **가능**        | `fiber.memoizedProps.onPress()`                                          |
| 텍스트로 클릭          | **가능**        | Fiber 순회 → 텍스트 매칭 → `onPress()`                                   |
| WebView JS 실행        | **불가능**      | `stateNode=null` (forwardRef function component, tag:11)                 |

### 6.2 WebView만 Babel 필수인 이유

| 컴포넌트                       | Fiber tag       | stateNode           | 메서드 접근                  |
| ------------------------------ | --------------- | ------------------- | ---------------------------- |
| ScrollView                     | 1 (Class)       | ScrollView instance | `.scrollTo()` 있음           |
| FlatList                       | 1 (Class)       | FlatList instance   | `.scrollToOffset()` 있음     |
| WebView (react-native-webview) | 11 (ForwardRef) | `null`              | `injectJavaScript` 접근 불가 |

`react-native-webview`의 WebView는 `forwardRef` 기반이라 Fiber `stateNode`가 `null`.
`injectJavaScript`는 React imperative handle로 노출되며, ref callback으로만 캡처 가능.

### 6.3 Fiber 내부 API 의존성

현재 모든 Fiber 기반 기능이 의존하는 React 내부 API:

- `fiber.child` / `fiber.sibling` — 트리 순회
- `fiber.memoizedProps` — props 접근 (onPress, testID 등)
- `fiber.stateNode` — 컴포넌트 인스턴스 (class component만)
- `fiber.type` — 컴포넌트 타입 판별
- `fiber.tag` — 노드 종류 (0=Function, 1=Class, 5=Host, 11=ForwardRef 등)

이 중 어느 하나라도 바뀌면 전체 Fiber 기반 기능이 영향받음. `stateNode`만의 리스크가 아님.
React DevTools도 동일한 내부 API에 의존.

### 6.4 재활성화 가이드

ScrollView/FlatList가 class→function component로 전환되거나,
`memoizedProps` 구조가 변경될 경우 Babel 주입 재활성화:

```ts
// packages/react-native-mcp-server/src/babel/inject-testid.ts
const INJECT_PRESS_HANDLER = true; // false → true
const INJECT_SCROLL_REF = true; // false → true
```

---

## 7. 참고 자료

### 7.1 오픈소스

1. **React DevTools**
   - `packages/react-devtools-shared/src/backend/`
   - Fiber tree hooking 방식

2. **Flipper**
   - Metro 플러그인 + 네이티브 통합
   - 플러그인 아키텍처

3. **react-native-reanimated**
   - Babel worklet 주입 패턴
   - `__DEV__` 처리

4. **Reactotron**
   - WebSocket 개발 도구
   - 네트워크/상태 추적

### 7.2 공식 문서

- Metro: https://metrobundler.dev/
- Babel Plugin Handbook: https://github.com/jamiebuilds/babel-handbook
- React Fiber Architecture: https://github.com/acdlite/react-fiber-architecture
- MCP Specification: https://modelcontextprotocol.io/

---

## 8. 리스크 & 제약사항

### 8.1 기술적 리스크

1. **React Fiber 내부 API 변경**
   - 완화: React DevTools 패턴 따르기

2. **Metro API 변경**
   - 완화: 공식 API 우선 사용

3. **성능 오버헤드**
   - 완화: 개발 모드 전용

4. **보안**
   - 완화: localhost만 허용, 프로덕션 제거

### 8.2 기능적 제약

1. **iOS 실기기 스크린샷** - simctl은 시뮬레이터 전용이라 실기기에서는 미지원
2. **가상화 목록 한계** - FlatList 미렌더링 아이템은 네이티브 `swipe` 도구로 수동 스크롤 후 조회 가능하지만, 에이전트가 자동으로 전체 목록을 탐색하는 기능은 미구현
3. **서드파티 네이티브 컴포넌트** - 제어 어려움

### 8.3 현실적 접근

- **완벽 불필요**: Chrome MCP도 한계 존재
- **점진적 개선**: Phase 1만으로도 유용
- **커뮤니티 피드백**: 실제 사용 사례 반영

---

## 9. 성공 기준

### Phase 1 (MVP)

- [x] MCP 서버가 Cursor/Claude에서 인식
- [x] 앱에서 코드 실행 가능 (evaluate_script)
- [x] WebSocket 연결 안정 (12300)

### Phase 2

- [x] 컴포넌트 트리 조회 (take_snapshot, query_selector_all)
- [x] testID로 컴포넌트 검색 (query_selector)

### Phase 3

- [x] AI가 버튼 클릭 등 조작 (네이티브 tap 도구로 실제 터치 주입)
- [x] 프로덕션 빌드에서 WebSocket 미연결 (`__DEV__` 체크, `REACT_NATIVE_MCP_ENABLED` 또는 `MCP.enable()` 활성화)
- [ ] Dead code elimination 검증

### Phase 4

- [x] AI가 화면 보고 판단 (take_screenshot)

### 최종

- [ ] Chrome MCP 수준 자동화 (RN 환경)
- [ ] npm 배포 가능 안정성
- [ ] 문서 및 예제 완비

---

## 10. 프로그래매틱 테스트 러너 (YAML / 스크립트 기반)

> 구체적인 구현 계획은 **[E2E 테스트 계획 문서](./e2e-test-plan.md)** 참조.

### 10.1 개요

MCP 서버는 AI 에이전트뿐 아니라 **비-AI 테스트 러너**에서도 동일하게 사용 가능하다.
MCP는 프로토콜일 뿐이므로 클라이언트가 AI일 필요가 없다.

```
AI 에이전트  ─┐
              ├→ MCP 클라이언트 → MCP 서버 (12300) → React Native 앱
YAML 러너   ─┘
```

Maestro 등 기존 E2E 도구는 플랫폼별 네이티브 API(XCUITest, UiAutomator)에 의존하지만,
본 MCP 서버는 **Fiber 트리 하나로 iOS/Android 동일 동작**한다.

### 10.2 YAML 기반 테스트 예시

```yaml
name: 로그인 플로우
steps:
  - query: 'TextInput#email-input'
    action: type_text
    text: 'user@example.com'
  - query: 'TextInput#password-input'
    action: type_text
    text: 'secret123'
  - query: 'Pressable:text("로그인")'
    action: tap
  - wait: 2000
  - query: 'Text:text("환영합니다")'
    assert: exists
  - screenshot: { path: './results/login-success.png' }
```

### 10.3 MCP 클라이언트 직접 호출 (스크립트)

```ts
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const client = new Client({ name: 'test-runner', version: '1.0.0' });
await client.connect(
  new StdioClientTransport({
    command: 'bun',
    args: ['dist/index.js'],
  })
);

// 테스트 시나리오: query_selector로 좌표 획득 → 네이티브 tap/swipe로 조작
const el = await client.callTool({
  name: 'query_selector',
  arguments: { selector: ':text("Count:")' },
});
await client.callTool({ name: 'tap', arguments: { platform: 'ios', x: el.x, y: el.y } });
const result = await client.callTool({ name: 'assert_text', arguments: { text: 'Count: 1' } });
await client.callTool({
  name: 'swipe',
  arguments: { platform: 'ios', x1: 200, y1: 600, x2: 200, y2: 200 },
});
```

### 10.4 Babel 필요 여부

| 테스트 방식                    | Babel 필요?         | 설명                                           |
| ------------------------------ | ------------------- | ---------------------------------------------- |
| 셀렉터 기반 (`query_selector`) | 불필요              | Fiber 트리 셀렉터 (타입/텍스트/속성)           |
| 좌표 탭 (`tap`)                | 불필요              | 네이티브 터치 주입 (idb/adb)                   |
| 좌표 스와이프 (`swipe`)        | 불필요              | 네이티브 스와이프 주입 (idb/adb)               |
| 롱프레스 (`tap` + duration)    | 불필요              | 네이티브 롱프레스 주입                         |
| 텍스트 입력 (`type_text`)      | 불필요              | Fiber onChangeText + setNativeProps (유니코드) |
| testID 기반 좌표 획득          | 자동 testID 시 필요 | `evaluate_script(measureView(testID))`         |
| WebView 제어                   | **필요**            | ref 주입은 Babel만 가능                        |
| 스크린샷                       | 불필요              | adb/simctl 호스트 CLI                          |

### 10.5 구현 계획

1. **YAML 스키마 정의**: 지원 액션 목록 (tap, swipe, type_text, assert, wait, screenshot)
2. **YAML 파서 → MCP 도구 매핑**: `query_selector`로 요소 좌표 획득 → `tap`/`swipe`/`type_text` 호출
3. **assert 도구 추가**: `assert_text`/`assert_visible`로 검증
4. **CLI 엔트리포인트**: `npx react-native-mcp-test run tests/login.yaml`
5. **리포트 출력**: 성공/실패 요약, 실패 시 스크린샷 첨부

---

## 11. 다음 단계

1. **CI-ready Assertion 강화** (최우선): assert_text/assert_visible에 polling 추가, assert_not_visible·scroll_until_visible 신규 도구. [상세: 섹션 14]
2. **Phase 3 보완**: Dead code elimination 검증
3. ~~**Phase 5**: 네트워크·콘솔 모니터링 완료 (XHR/fetch monkey-patch + nativeLoggingHook)~~ ✅
4. **FlatList 가상화 자동 탐색**: 전체 목록 자동 스크롤 + 수집 기능 → `scroll_until_visible` 도구로 부분 해결 예정
5. **프로그래매틱 테스트 러너**: 섹션 10 구현 (YAML 파서 + MCP Client + assertion)
6. ~~**네이티브 제스처 (drag/swipe/pinch)**~~: 완료. `tap`/`swipe` 등 통합 네이티브 도구로 구현됨 (멀티터치 제외)
7. **안정화**: npm 배포, 문서 정비

이 설계는 실험적이며, 구현 중 발견되는 제약사항에 따라 수정 가능합니다.

---

## 12. 네이티브 제스처 지원 분석

### 12.1 현재 상황

현재 MCP는 **네이티브 터치 주입**(idb/adb) + **Fiber props 호출**의 하이브리드 방식으로 동작한다:

- 좌표 탭/롱프레스 → `tap` (네이티브 터치)
- 스와이프/스크롤 → `swipe` (네이티브 터치)
- 텍스트 입력 → `type_text` (Fiber onChangeText, 유니코드 지원)
- 키 입력 → `input_text` / `input_key` (네이티브)

대부분의 제스처가 네이티브 레벨에서 커버되지만, 멀티터치(핀치/회전)는 여전히 제한적이다.

### 12.2 제스처 유형별 분석

| 제스처                          | 현재 지원 | Fiber props로 가능? | 비고                                                        |
| ------------------------------- | --------- | ------------------- | ----------------------------------------------------------- |
| tap (onPress)                   | ✅        | ✅                  | 구현됨                                                      |
| long press (onLongPress)        | ✅        | ✅                  | 구현됨                                                      |
| scroll (scrollTo)               | ✅        | ✅                  | 구현됨                                                      |
| text input (onChangeText)       | ✅        | ✅                  | 구현됨                                                      |
| RNGH TouchableOpacity tap       | ✅        | ✅                  | 검증됨 — Fiber onPress 직접 호출 (iOS/Android)              |
| Reanimated Animated.ScrollView  | ✅        | ✅                  | 검증됨 — Fiber stateNode.scrollTo() 정상 동작 (iOS/Android) |
| Reanimated 래핑 컴포넌트 tap    | ✅        | ✅                  | 검증됨 — Animated.View 내 GHTouchableOpacity onPress 호출   |
| swipe to delete                 | ❌        | ❓                  | 라이브러리 의존 (Swipeable, react-native-gesture-handler)   |
| pull to refresh                 | ❌        | ✅ 가능성           | `onRefresh` props 호출로 가능할 수 있음                     |
| drag & drop                     | ❌        | ❓                  | PanResponder 콜백 시뮬레이션 복잡                           |
| pinch to zoom                   | ❌        | ❓                  | react-native-gesture-handler 네이티브 레벨                  |
| RNGH Gesture.Pan/Pinch/Rotation | ❌        | ❌                  | 네이티브 스레드에서 실행, JS 콜백 없음                      |
| drawer swipe                    | ❌        | ✅ 가능성           | react-navigation drawer의 `openDrawer()` 메서드             |
| tab swipe (ViewPager)           | ❌        | ✅ 가능성           | `setPage(index)` 또는 `scrollTo`                            |
| bottom sheet drag               | ❌        | ❓                  | @gorhom/bottom-sheet 등 라이브러리 의존                     |

### 12.3 접근 방식 후보

#### 방식 A: Fiber props 확장 (네이티브 모듈 불필요)

현재 방식의 연장. React props에 노출된 콜백/메서드를 찾아 호출:

- `onRefresh()` → pull to refresh
- `openDrawer()` / `closeDrawer()` → drawer
- `setPage(index)` → ViewPager/TabView
- PanResponder의 `onPanResponderMove` 등에 합성 이벤트 전달

**장점**: 네이티브 모듈 불필요, 기존 아키텍처 유지
**단점**: 라이브러리마다 API가 다름, 합성 이벤트 생성이 복잡, 모든 제스처를 커버 못 함

#### 방식 B: 좌표 기반 터치 시뮬레이션 (호스트 CLI)

`adb shell input` / iOS 시뮬레이터 API로 화면 좌표에 터치 이벤트 전송:

```bash
# Android
adb shell input tap 200 400
adb shell input swipe 300 800 300 200 500

# iOS (simctl은 제한적, XCTest 필요)
```

요소 좌표는 `UIManager.measure()` 또는 Fiber에서 `ref.measure()`로 획득.

**장점**: 모든 제스처 가능, 라이브러리 무관
**단점**: 기기별 화면 크기/밀도 차이, 상태바/노치 오프셋, 앱 상태와 비동기, iOS 실기기 미지원. `adb shell input`으로 프로덕션 E2E를 하는 주요 도구는 없음 (Maestro/Appium/Detox 모두 네이티브 API 사용)

#### 방식 C: 네이티브 모듈 추가 (옵션)

Maestro/Detox처럼 경량 네이티브 모듈을 앱에 설치:

- Android: Espresso / UiAutomator2 연동
- iOS: XCUITest 연동
- 앱 내에서 정확한 좌표 기반 터치 이벤트 생성

**장점**: 가장 안정적, 모든 제스처 지원
**단점**: "네이티브 모듈 없이 동작" 원칙에 어긋남, 설치 복잡도 증가

#### 방식 D: 하이브리드 (A + 필요시 B)

기본은 Fiber props 호출(방식 A), 커버 안 되는 경우만 좌표 기반(방식 B) fallback:

1. `query_selector`로 요소 찾기
2. Fiber props에 적절한 콜백이 있으면 JS 호출
3. 없으면 `UIManager.measure()`로 좌표 획득 → `adb shell input` / simctl

### 12.4 주요 라이브러리별 제어 가능성

| 라이브러리                      | 제스처            | Fiber props로 제어                | 비고                                                 |
| ------------------------------- | ----------------- | --------------------------------- | ---------------------------------------------------- |
| RN ScrollView                   | 스크롤            | ✅ `scrollTo()`                   | 구현됨                                               |
| RN FlatList                     | 스크롤            | ✅ `scrollToOffset()`             | 구현됨                                               |
| RN RefreshControl               | 당겨서 새로고침   | ✅ `onRefresh()`                  | props 호출 가능                                      |
| RN Switch                       | 토글              | ✅ `onValueChange(true/false)`    | props 호출 가능                                      |
| RN Slider                       | 값 변경           | ✅ `onValueChange(value)`         | props 호출 가능                                      |
| react-navigation Drawer         | 열기/닫기         | ✅ `navigation.openDrawer()`      | ref/imperative handle                                |
| react-navigation TabView        | 탭 전환           | ✅ `navigation.navigate(tabName)` | JS API                                               |
| RNGH TouchableOpacity/Pressable | 탭                | ✅ `onPress()` / `onLongPress()`  | **검증됨** — Fiber props 직접 호출 (iOS/Android)     |
| RNGH Gesture.Pan/Pinch/Rotation | 스와이프/팬/핀치  | ❌ 네이티브 레벨                  | 네이티브 스레드 실행, JS 콜백 없음                   |
| reanimated Animated.ScrollView  | 스크롤            | ✅ `scrollTo()`                   | **검증됨** — Fiber stateNode 접근 가능 (iOS/Android) |
| reanimated Animated.View + 터치 | 탭                | ✅ `onPress()`                    | **검증됨** — 내부 Pressable의 Fiber props 호출       |
| reanimated worklet 제스처       | 애니메이션 제스처 | ❌ 워클릿 네이티브                | JS 스레드 밖에서 실행                                |
| @gorhom/bottom-sheet            | 시트 이동         | ✅ `ref.snapToIndex(i)`           | imperative handle                                    |

### 12.5 결론 및 방향

1. **단기**: 방식 A — Fiber props 호출 범위를 확장 (onRefresh, onValueChange 등 추가)
2. **중기**: 방식 D (하이브리드) — 좌표 기반 fallback 실험, 신뢰도 검증
3. **장기**: 필요에 따라 방식 C (네이티브 모듈) 검토 — 옵셔널 플러그인 형태

> **검증 완료 (iOS/Android)**: RNGH의 TouchableOpacity/Pressable 탭, Reanimated의 Animated.ScrollView 스크롤,
> Animated.View 내부 터치 컴포넌트 탭은 Fiber props로 정상 동작한다 (testID·라벨 방식 모두).
> 단, RNGH의 `Gesture.Pan/Pinch/Rotation` 등 **네이티브 제스처 시스템**과
> Reanimated **worklet 기반 제스처 핸들러**는 네이티브 스레드에서 실행되므로 Fiber props로는 제어 불가.

---

## 13. 확장 제스처 지원 — onPress 이외 인터랙션

현재 MCP는 `onPress`, `onLongPress`, `scrollTo()` 등 **JS 콜백/메서드 호출** 방식으로 동작한다.
그러나 실제 앱에서는 스와이프, 드래그, 핀치, 드로워, 바텀시트 등 **네이티브 터치 파이프라인**을 거치는 제스처가 필수적이다.

이 섹션에서는 MCP의 제스처 지원을 4단계(Tier)로 확장하는 설계를 정리한다.

### 13.1 현재 지원 범위 (Tier 0)

| 인터랙션        | MCP 도구                   | 방식                            |
| --------------- | -------------------------- | ------------------------------- |
| 탭              | `tap`                      | 네이티브 터치 주입 (idb/adb)    |
| 롱프레스        | `tap` (duration)           | 네이티브 롱프레스 (idb/adb)     |
| 스와이프/스크롤 | `swipe`                    | 네이티브 스와이프 (idb/adb)     |
| 텍스트 입력     | `type_text`                | `onChangeText` + setNativeProps |
| 키 입력         | `input_text` / `input_key` | 네이티브 키 입력 (idb/adb)      |
| WebView JS 실행 | `webview_evaluate_script`  | injectedJavaScript              |

**한계**: 멀티터치(핀치/회전)는 idb/adb 모두 단일 터치만 지원하여 불가.

### 13.2 Tier 1 — JS Prop/Imperative 호출 확장

Fiber props나 imperative handle을 통해 **JS 레벨에서 직접 호출 가능**한 제스처들.
네이티브 터치 없이 동작하므로 가장 안정적이고 토큰 효율적.

**이미 구현됨 (Tier 0)**: 탭(`tap`), 롱프레스(`tap` + duration), 스와이프/스크롤(`swipe`), **텍스트 입력(`type_text`)** — Tier 1 "추가 대상"은 이외 항목만 해당.

#### 추가 대상 (미구현 — `trigger_prop` 등으로 보완 예정)

| 컴포넌트                 | 제스처          | 호출 방식                                                            |
| ------------------------ | --------------- | -------------------------------------------------------------------- |
| RefreshControl           | 당겨서 새로고침 | `onRefresh()` props 호출                                             |
| Switch                   | 토글            | `onValueChange(bool)` props 호출                                     |
| Slider                   | 값 변경         | `onValueChange(number)` props 호출                                   |
| TextInput                | 포커스/블러만   | `ref.focus()` / `ref.blur()` (텍스트 입력은 `type_text`로 이미 지원) |
| @gorhom/bottom-sheet     | 시트 이동       | `ref.snapToIndex(i)` / `ref.close()`                                 |
| react-navigation Drawer  | 열기/닫기       | `navigation.openDrawer()` / `closeDrawer()`                          |
| react-navigation TabView | 탭 전환         | `navigation.navigate(tabName)`                                       |
| Swipeable (RNGH)         | 스와이프 메뉴   | `ref.openRight()` / `ref.close()`                                    |
| Accordion/Collapsible    | 열기/닫기       | `onPress()` 또는 상태 토글                                           |

#### 구현 방법

```javascript
// runtime.js에 새 MCP 도구 추가
// 예: trigger_prop — 임의 Fiber props 함수를 호출
function triggerProp(testID, propName, ...args) {
  const fiber = findFiberByTestID(testID);
  const handler = fiber?.memoizedProps?.[propName];
  if (typeof handler === 'function') {
    handler(...args);
    return { success: true };
  }
  return { success: false, reason: 'prop not found or not a function' };
}
```

**예상 토큰**: 요청 ~50 + 응답 ~50 = **~100 토큰/호출**

### 13.3 Tier 2 — 시스템 터치 주입 (idb/adb) + MCP 좌표

RNGH `Gesture.Pan/Pinch/Rotation`, Reanimated worklet 등 **네이티브 터치 파이프라인이 필수**인 제스처.
MCP로 요소 좌표를 획득하고, idb(iOS)/adb(Android)로 터치를 주입하는 **하이브리드** 방식.

#### 검증된 시나리오 (iOS iPad 시뮬레이터, idb)

| 제스처                           | idb 명령                           | 검증 결과           |
| -------------------------------- | ---------------------------------- | ------------------- |
| 드로워 열기 (좌측 엣지 스와이프) | `idb ui swipe 15 400 250 400 0.3`  | ✅ 성공             |
| 드로워 닫기 (좌측 스와이프)      | `idb ui swipe 250 400 15 400 0.3`  | ✅ 성공             |
| 페이저 스와이프 (좌→우)          | `idb ui swipe 600 500 200 500 0.3` | ✅ 성공             |
| 바텀시트 드래그                  | `idb ui swipe x y1 x y2 0.5`       | ✅ 성공             |
| 오버레이 탭                      | `idb ui tap x y`                   | ✅ 성공             |
| WebView 내부 탭                  | `idb ui tap x y`                   | ✅ 성공             |
| WebView 텍스트 입력              | `idb ui tap` → `idb ui text`       | ✅ 성공 (영문/숫자) |

#### 워크플로우

```
1. MCP query_selector → 요소 좌표 획득 (~100 토큰)
2. idb/adb swipe/tap → 터치 주입 (~30 토큰)
3. MCP assert_text → 결과 검증 (~50 토큰)
────────────────────────────────
총 ~180 토큰/제스처 (vs idb-only describe-all: ~2,000-4,000 토큰)
```

#### idb 주요 커맨드 정리 (iOS)

```bash
# 탭
idb ui tap <x> <y>

# 스와이프 (시작→끝, duration 초)
idb ui swipe <x1> <y1> <x2> <y2> <duration>

# 텍스트 입력 (영문/숫자만 안정적)
idb ui text "hello"

# 키 입력 (HID keycode)
idb ui key <keycode>    # 42=Backspace, 40=Return

# 접근성 트리 전체
idb ui describe-all

# 특정 좌표의 요소 (WebView 내부도 관통)
idb ui describe-point <x> <y>
```

#### adb 주요 커맨드 정리 (Android)

```bash
# 탭
adb shell input tap <x> <y>

# 스와이프
adb shell input swipe <x1> <y1> <x2> <y2> <duration_ms>

# 텍스트 입력
adb shell input text "hello"

# 키 입력
adb shell input keyevent <KEYCODE>  # 67=DEL, 66=ENTER
```

### 13.4 Tier 3 — MCP 내장 터치 합성 (향후)

외부 도구(idb/adb) 없이 MCP 런타임에서 직접 터치 이벤트를 합성하는 방식.
RN의 내부 이벤트 시스템을 활용.

#### 가능성 조사

```javascript
// RN 내부 이벤트 디스패처
// - RCTEventDispatcher (iOS)
// - UIManagerModule.dispatchViewManagerCommand (Android)
// - ReactNativePrivateInterface.nativeFabricUIManager (Fabric)

// PanResponder 계열은 JS 이벤트이므로 합성 가능:
// - onStartShouldSetPanResponder
// - onPanResponderGrant/Move/Release

// 그러나 RNGH Gesture.Pan 등은 네이티브 스레드에서
// UIGestureRecognizer/GestureDetector가 처리하므로
// JS에서 합성한 이벤트가 전달되지 않음
```

**결론**: PanResponder 기반 제스처는 JS 합성 가능하나, RNGH/Reanimated worklet은 불가.
따라서 Tier 2 (idb/adb)가 네이티브 제스처의 유일한 완전 해법.

### 13.5 토큰 효율성 비교

| 작업                 | idb-only                         | MCP-only                                                                                       | 하이브리드 (MCP+idb)       |
| -------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------- |
| 요소 찾기            | `describe-all` ~2,000-4,000 토큰 | `query_selector` ~100 토큰                                                                     | `query_selector` ~100 토큰 |
| 텍스트 확인          | `describe-all` ~2,000-4,000 토큰 | `assert_text` ~50 토큰                                                                         | `assert_text` ~50 토큰     |
| 좌표 확인            | `describe-point` ~50 토큰        | `evaluate_script(measureView(uid))` ~150 토큰. uid = testID 또는 query_selector 경로("0.1.2"). | MCP ~150 토큰              |
| 탭 실행              | `idb ui tap` ~30 토큰            | `tap` ~30 토큰 (통합)                                                                          | 동일 (네이티브 통합)       |
| 스와이프 실행        | `idb ui swipe` ~30 토큰          | ❌ 불가                                                                                        | `idb ui swipe` ~30 토큰    |
| **드로워 열기+확인** | ~4,060 토큰                      | ❌ 불가                                                                                        | **~180 토큰**              |

> **결론**: 하이브리드 방식이 idb-only 대비 **~20-50배** 토큰 효율적.
> MCP를 "눈"(요소 탐색, 결과 검증)으로, idb/adb를 "손"(터치 주입)으로 사용.

### 13.6 WebView 인터랙션

#### 발견 사항

- `idb ui describe-all`: WebView 내부 요소 **미표시** (RCTWebView로만 표시)
- `idb ui describe-point x y`: WebView 내부 요소 **표시됨** (버튼, 입력필드 등 접근성 정보)
- `idb ui tap x y`: WebView 내부 클릭 **정상 동작**
- MCP `webview_evaluate_script`: WebView DOM 직접 조작 가능

#### 권장 접근

1. **MCP 우선**: `webview_evaluate_script`로 DOM 쿼리 + JS 실행 (가장 정확, 토큰 효율적)
2. **idb 보조**: 네이티브 키보드 입력, 스크롤 등 WebView JS로 어려운 경우 좌표 기반 터치

### 13.7 알려진 제한사항

| 제한            | 설명                                | 우회 방법                                                     |
| --------------- | ----------------------------------- | ------------------------------------------------------------- |
| 한글 입력 (idb) | `idb ui text "한글"` → 앱 크래시    | 두벌식 매핑 (예: "네이버"→"spdlqj") + 소프트 키보드 한글 모드 |
| iOS 실기기      | idb/simctl 터치 주입 미지원         | XCTest 프레임워크 필요 (Tier 3+)                              |
| HID 키코드 충돌 | Return(40)이 iPad 멀티태스킹 트리거 | 앱별 HID 매핑 확인 필요                                       |
| 멀티터치        | idb는 단일 터치만 지원              | 핀치/회전은 idb로 불가, 네이티브 모듈 필요                    |
| 화면 좌표 변환  | 시뮬레이터 스케일, 상태바 오프셋    | `getScreenInfo()` + `measureView()` 활용                      |

### 13.8 구현 로드맵

| 단계        | 내용                                                                                                               | 우선순위 |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| **Phase 1** | Tier 1 — `trigger_prop` 도구 추가 (onRefresh, onValueChange, ref.focus 등). 탭/롱프레스/텍스트 입력은 이미 구현됨. | 높음     |
| **Phase 2** | `measure_view` / `get_screen_info` MCP 도구 노출                                                                   | 높음     |
| **Phase 3** | Tier 2 문서화 — idb/adb 명령어 가이드 + 워크플로우 예시                                                            | 중간     |
| **Phase 4** | ~~Tier 2 자동화~~ — 완료. `tap`/`swipe`/`input_text`/`input_key`/`press_button` 통합 도구로 구현됨.                | ✅ 완료  |
| **Phase 5** | Tier 3 조사 — RN 내부 이벤트 합성 PoC                                                                              | 낮음     |

---

## 14. CI-ready Assertion & Wait 도구 강화

> flutter-skill 등 유사 프로젝트 비교 분석 결과, GitHub Actions CI에서 안정적 자동화를 위해 MCP 도구 레벨에서 polling/wait 메커니즘이 필수.
> e2e-test-plan.md의 Phase B (SDK 레벨 waitFor)와는 별개로, **MCP 도구 자체**에 polling을 내장해야 AI 에이전트와 프로그래매틱 테스트 러너 모두 활용 가능.

### 14.1 현재 문제

| 항목                   | 현재 상태                                  | 문제                                              |
| ---------------------- | ------------------------------------------ | ------------------------------------------------- |
| `assert_text`          | 단발성(single-shot), 10s 하드코딩 타임아웃 | 요소 미렌더링 시 즉시 FAIL → CI에서 flaky test    |
| `assert_visible`       | 단발성, 10s 하드코딩 타임아웃              | 동일                                              |
| `assert_not_visible`   | 미존재                                     | 모달 닫힘, 로딩 완료 검증 불가                    |
| `scroll_until_visible` | 미존재                                     | 긴 리스트에서 요소 찾기 위해 수동 swipe 반복 필요 |
| `assert_element_count` | 미존재                                     | 리스트 아이템 개수 검증 불가                      |

CI 환경에서는 AI가 "실패했네, 다시 해볼까" 판단을 못 하므로, 도구 자체에 재시도 메커니즘이 필수.

### 14.2 비교 분석 (flutter-skill 참조)

> 참조: https://github.com/ai-dashboad/flutter-skill/tree/main/sdks/react-native

flutter-skill의 React Native SDK는 polling 기반 wait 메커니즘을 내장:

```javascript
// flutter-skill의 wait_for_gone 구현 (200ms 간격 polling)
methods.wait_for_gone = function (params) {
  const timeout = params.timeout || 5000;
  const start = Date.now();
  function check() {
    const entry = _findElement(params);
    if (!entry) return Promise.resolve({ success: true });
    if (Date.now() - start > timeout) return Promise.resolve({ success: false });
    return new Promise((resolve) => setTimeout(() => resolve(check()), 200));
  }
  return check();
};
```

flutter-skill에서 참고할 만한 도구와 불필요한 도구:

**참고할 것 (CI 필수)**:

- `assert_visible` / `assert_not_visible`에 `timeout` 파라미터 (기본 5000ms, polling)
- `wait_for_element` / `wait_for_gone` (polling 기반 대기)
- `scroll_until_visible` (`max_scrolls`, `direction`, `scrollable_key`)
- `assert_element_count` (`expected_count`, `min_count`, `max_count`)

**불필요한 것**:

- `wait_for_idle` (UI 안정성 대기) — 판단 기준이 모호하고 오판 가능. Playwright도 deprecated 방향
- `networkIdle` — WebSocket/SSE/polling API 등으로 오판 빈번. text/element 기반 assertion이 더 안정적
- `compare_screenshot` (visual regression) — 별도 인프라 필요, 코어 안정화 후
- `record_start/stop/export` (test codegen) — 좋지만 우선순위 낮음
- `auth_biometric/otp/deeplink` — 앱별로 다름, 범용 도구로 부적합
- `diagnose` — AI 에이전트가 이미 컨텍스트 기반 판단 가능

### 14.3 구현 계획

#### Step 1: 기존 도구에 polling 추가 (필수)

`assert_text`, `assert_visible`에 `timeoutMs`/`intervalMs` 파라미터 추가:

```typescript
// MCP 도구 파라미터 (기존 + 신규)
{
  text: string,           // assert_text
  selector?: string,      // assert_text (범위 한정), assert_visible (대상)
  timeoutMs?: number,     // 신규: 최대 대기 시간 (기본 0 = 즉시, 하위 호환)
  intervalMs?: number,    // 신규: polling 간격 (기본 300ms)
}
```

**동작 방식**:

1. 조건 체크 → 성공하면 즉시 `{ pass: true }` 반환
2. `timeoutMs > 0`이면 실패 시 `intervalMs` 후 재시도
3. `timeoutMs` 초과하면 최종 `{ pass: false }` 반환
4. `timeoutMs = 0` (기본값)이면 기존처럼 단발성 → **하위 호환 보장**

**구현 위치**: `runtime.js`에 polling 루프 추가. 서버 측 `assert.ts`는 `timeoutMs`를 eval 코드에 전달만.

```javascript
// runtime.js 내 polling 구현 (예시)
function waitForCondition(checkFn, timeoutMs, intervalMs) {
  if (!timeoutMs || timeoutMs <= 0) return checkFn();
  var start = Date.now();
  function poll() {
    var result = checkFn();
    if (result.pass) return Promise.resolve(result);
    if (Date.now() - start >= timeoutMs) return Promise.resolve(result);
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(poll());
      }, intervalMs || 300);
    });
  }
  return poll();
}
```

#### Step 2: assert_not_visible 신규 도구 (필수)

```typescript
// MCP 도구: assert_not_visible
{
  selector: string,       // 사라져야 할 요소
  timeoutMs?: number,     // 최대 대기 시간 (기본 0)
  intervalMs?: number,    // polling 간격 (기본 300ms)
}
// 반환: { pass: boolean, message: string }
```

사용 예시: 로딩 스피너 사라짐 확인, 모달 닫힘 확인, 삭제된 아이템 부재 확인.

#### Step 3: scroll_until_visible 신규 도구 (높음)

```typescript
// MCP 도구: scroll_until_visible
{
  selector: string,            // 찾을 요소 셀렉터
  direction?: 'up' | 'down' | 'left' | 'right',  // 기본 'down'
  maxScrolls?: number,         // 최대 스크롤 횟수 (기본 10)
  scrollableSelector?: string, // 스크롤 대상 (미지정 시 화면 중앙 기준 swipe)
  platform: 'ios' | 'android',
}
// 반환: { pass: boolean, element?: { uid, measure }, scrollCount: number }
```

**내부 동작**:

1. `querySelector(selector)` → 발견 시 즉시 반환
2. 미발견 시 `swipe`로 한 화면 스크롤
3. 다시 `querySelector` → 반복
4. `maxScrolls` 초과 시 `{ pass: false }`

이 도구는 FlatList 가상화 문제를 자연스럽게 해결 — 미렌더링 아이템도 스크롤하면 나타남.

#### Step 4: assert_element_count 신규 도구 (선택)

```typescript
// MCP 도구: assert_element_count
{
  selector: string,
  expectedCount?: number,    // 정확한 개수
  minCount?: number,         // 최소 개수
  maxCount?: number,         // 최대 개수
  timeoutMs?: number,        // polling 지원
  intervalMs?: number,
}
// 반환: { pass: boolean, actualCount: number, message: string }
```

### 14.4 구현 우선순위

```
Step 1: assert_text/assert_visible polling ──┐
Step 2: assert_not_visible                   ├→ CI 안정적 자동화 가능
Step 3: scroll_until_visible                 │
Step 4: assert_element_count (선택)          ┘
```

| Step | 도구                                 | 구현 범위                                      | 우선순위 |
| ---- | ------------------------------------ | ---------------------------------------------- | -------- |
| 1    | assert_text/assert_visible + polling | runtime.js (~30줄) + assert.ts 파라미터 추가   | **필수** |
| 2    | assert_not_visible                   | runtime.js (~20줄) + 신규 도구 등록            | **필수** |
| 3    | scroll_until_visible                 | 신규 도구 (~80줄, query_selector + swipe 조합) | **높음** |
| 4    | assert_element_count                 | runtime.js (~15줄) + 신규 도구 등록            | 선택     |

**Step 1~2 완료 시**: AI 에이전트 + 프로그래매틱 테스트에서 flaky test 문제 해결.
**Step 3 완료 시**: 긴 리스트 자동 탐색 가능 (FlatList 가상화 문제 부분 해결).
**전체 완료 시**: e2e-test-plan.md Phase B (SDK 레벨 waitFor)의 기반 인프라 확보.

---

## 15. 앱 생명주기 — MCP Resource 가이드 방식

> 앱 실행/종료/딥링크는 명령어가 단순하므로 **별도 MCP 도구를 만들지 않고**, MCP Resource(가이드)로 제공한다.
> AI 에이전트가 리소스를 읽고 기존 Bash/shell 도구로 직접 실행하는 방식.
> query-selector 가이드(`docs://guides/query-selector-syntax`)와 동일한 패턴.

### 15.1 구현

```
src/guides/app-lifecycle.ts    →  MCP Resource "docs://guides/app-lifecycle"
src/resources/app-lifecycle.ts →  registerAppLifecycleResource()
src/resources/index.ts         →  registerAllResources()에 등록
```

가이드에 포함할 내용 (ADB_REFERENCE.md, IDB_REFERENCE.md에서 발췌):

| 작업          | Android                                     | iOS 시뮬레이터                                     |
| ------------- | ------------------------------------------- | -------------------------------------------------- |
| 앱 실행       | `adb shell am start -n {pkg}/.MainActivity` | `xcrun simctl launch booted {bundleId}`            |
| 앱 종료       | `adb shell am force-stop {pkg}`             | `xcrun simctl terminate booted {bundleId}`         |
| 딥링크        | `adb shell am start -a VIEW -d "{url}"`     | `xcrun simctl openurl booted "{url}"`              |
| 데이터 초기화 | `adb shell pm clear {pkg}`                  | `xcrun simctl privacy booted reset all {bundleId}` |
| 앱 설치       | `adb install {path.apk}`                    | `xcrun simctl install booted {path.app}`           |

### 15.2 MCP 도구가 아닌 이유

1. **명령어가 단순** — 플랫폼별 1줄 명령어. `tap`/`swipe`처럼 좌표 변환이나 복합 로직이 불필요
2. **AI 에이전트는 Bash 접근 가능** — Cursor, Claude Code 등에서 이미 터미널 실행 가능
3. **앱마다 다름** — Activity 이름, bundleId, 딥링크 스킴 등이 앱별로 달라서 범용 도구화 어려움
4. **가이드만으로 충분** — AI가 리소스를 읽고 명령어를 구성하면 됨

### 15.3 AI 에이전트 워크플로우

```
사용자: "앱을 재시작하고 로그인 화면 확인해줘"
AI:
  1. (리소스 "docs://guides/app-lifecycle" 참조)
  2. Bash: adb shell am force-stop com.example.app
  3. Bash: adb shell am start -n com.example.app/.MainActivity
  4. assert_visible({ selector: "#login-screen", timeoutMs: 5000 })
```

### 15.4 Phase A (SDK)에서의 활용

프로그래매틱 SDK 구현 시에는 `createApp()` 내부에서 위 명령어를 실행 + WebSocket 연결 대기(polling)를 조합:

```typescript
const app = await createApp({
  platform: 'android',
  bundleId: 'com.example.app',
  timeout: 30000,
});
// 내부적으로:
// 1. adb shell am start 실행
// 2. get_debugger_status polling → appConnected: true 까지 대기
// 3. resolve

await app.terminate();
// 내부적으로: adb shell am force-stop 실행
```

이때 `waitForConnection` 로직은 SDK 내부에서 처리. MCP 도구 레벨에서는 불필요.
