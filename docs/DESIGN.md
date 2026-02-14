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
| 선택자    | CSS selector          | testID, component path                           |
| 조작      | querySelector + click | Fiber + event trigger                            |
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
- `scroll` 도구로 수동 스크롤 → 렌더링된 항목을 `list_clickables`/`list_text_nodes`로 조회
- 자동화된 전체 목록 탐색은 미구현

#### Modal/Overlay 추적 ✅

RN의 Modal은 JS 컴포넌트이므로 Fiber 트리에 포함됨. 기존 도구(take_snapshot, list_clickables, click 등)로 별도 처리 없이 동작.

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
│   └── demo-app/                   # 테스트용 RN 앱
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
│  - Tools: evaluate_script, list_clickables, etc.│
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
App 실행 → __DEV__=false → WebSocket 미연결 (MCP.enable() 호출 시 수동 활성화 가능)
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

- `evaluate_script` - 앱 컨텍스트에서 JS 함수 실행 ✅
- `webview_evaluate_script` - 앱 내 WebView에서 임의 JS 실행 (injectJavaScript) ✅
- `take_snapshot` - React Fiber 트리 스냅샷 (컴포넌트 구조 JSON) ✅
- `take_screenshot` - ADB(Android) / simctl(iOS 시뮬레이터)로 캡처 ✅
- `scroll` - 등록된 ScrollView/FlatList의 scrollTo 호출 ✅
- `click` - testID(uid) 기반 클릭 ✅
- `click_by_label` - 텍스트 라벨로 onPress 호출 (testID 불필요) ✅
- `list_clickables` - Fiber 트리에서 클릭 가능 요소 목록 (uid + label) ✅
- `list_clickable_text_content` - 클릭 가능 요소의 전체 텍스트 ✅
- `list_text_nodes` - Fiber 트리의 모든 텍스트 노드 ✅
- `list_pages` - 연결된 앱 페이지 목록 ✅
- `get_by_label` / `get_by_labels` - Fiber 트리에서 라벨 검색 + 디버그 정보 ✅
- `get_debugger_status` - 앱 연결 상태 + 디바이스 목록 ✅
- `list_console_messages` - CDP Runtime.consoleAPICalled 수집 (보류 — CDP 연결 기능 일시 비활성화)
- `list_network_requests` - CDP Network.\* 이벤트 수집 (보류 — CDP 연결 기능 일시 비활성화)
- `set_props` - (예정)

**삭제된 Tools**:

- `click_webview` - `webview_evaluate_script`로 대체 (CSS selector 클릭만 가능 → 임의 JS 실행)
- `navigate_webview` - `webview_evaluate_script`로 대체 (`window.location.href = url`로 동일 동작)

### 4.2 Babel Plugin (inject-testid.ts)

> 별도 패키지 없음. `packages/react-native-mcp-server/src/babel/inject-testid.ts`에 통합.

**주입 기능** (개발/프로덕션 모두 적용):

1. **자동 testID**: JSX 요소에 `ComponentName-index-TagName` 형식 ID 주입
2. **displayName 주입**: PascalCase 함수 컴포넌트에 `.displayName` 자동 설정 (Release Fiber 트리 이름 보존)
3. **onPress 래핑**: testID + onPress가 있는 요소에 `registerPressHandler` 주입
4. **ScrollView/FlatList ref 주입**: testID가 있으면 `registerScrollRef`/`unregisterScrollRef` 자동 주입
5. **WebView ref 주입**: testID가 있으면 `registerWebView`/`unregisterWebView` 자동 주입
6. **동적 testID 지원**: TemplateLiteral, 변수 참조 등 동적 표현식 처리

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
    <TouchableOpacity
      testID="my-btn"
      onPress={__REACT_NATIVE_MCP__.registerPressHandler('my-btn', onPress)}
    >
      <Text testID="MyButton-0-Text">{title}</Text>
    </TouchableOpacity>
  );
}
```

### 4.3 Runtime (runtime.js)

> 별도 패키지 없음. `packages/react-native-mcp-server/runtime.js` 단일 파일.

**구성** (하나의 파일에 모두 포함):

1. **DevTools hook 설치**: `__REACT_DEVTOOLS_GLOBAL_HOOK__` 없으면 자동 생성 (Release 빌드 Fiber 접근)
2. **Fiber 트리 헬퍼**: `getFiberRoot`, `collectText`, `getLabel`, `getFiberTypeName`, `getComponentTree` 등
3. **Press 관리**: `registerPressHandler`, `triggerPress`, `getClickables`, `pressByLabel`
4. **Scroll 관리**: `registerScrollRef`, `unregisterScrollRef`, `scrollTo`
5. **WebView 관리**: `registerWebView`, `unregisterWebView`, `clickInWebView`, `evaluateInWebView`
6. **WebSocket 연결**: `__DEV__` 자동 연결, `MCP.enable()` 수동 활성화, 지수 백오프 재연결 (최대 30초)

**WebSocket 연결 조건**:

- `__DEV__ === true` → 자동 연결
- `__DEV__ === false` → `MCP.enable()` 호출 시 수동 연결
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
  - [x] `list_text_nodes` - 모든 텍스트 노드 수집 ✅
  - [x] `list_clickables` - 클릭 가능 요소 목록 ✅
  - [x] `get_by_label` - testID/이름 검색 ✅
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
  - [x] ScrollView/FlatList ref → `registerScrollRef` 자동 주입 (scroll 도구)
  - [x] WebView ref + testID → `registerWebView` 자동 주입 (webview_evaluate_script 도구)
  - [ ] 추적 코드 삽입 (미구현)
- [x] 프로덕션 처리
  - [x] Babel 변환은 항상 적용 (testID, ref, onPress 래핑)
  - [x] runtime은 `__DEV__` 체크 → false이면 WebSocket 미연결 (`MCP.enable()`으로 수동 활성화 가능)
  - [ ] Dead code elimination 검증 (미검증)
- [x] MCP 조작 (evaluate_script로 구현)
  - [x] testID로 onPress 트리거 (runtime `triggerPress(testID)` + Babel에서 `registerPressHandler` 주입)
  - [x] scroll 도구 — 등록된 ScrollView/FlatList의 scrollTo 호출
  - [x] webview_evaluate_script 도구 — WebView 내 임의 JS 실행
  - [ ] `set_props` - props 변경 (미구현)

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

- [x] Modal — React Fiber 트리에 포함되므로 기존 도구(take_snapshot, list_clickables, click 등)로 별도 처리 없이 동작
- [x] FlatList/ScrollView — scroll 도구로 수동 스크롤 후 list_clickables/list_text_nodes 조회·클릭 가능 (자동화된 가상화 탐색은 미구현)
- [ ] 네트워크 모니터링 — CDP 직접 연결로 `Network.*` 이벤트 수집 (`list_network_requests`) (보류 — CDP 연결 기능 일시 비활성화)
- [ ] 콘솔 모니터링 — `Runtime.consoleAPICalled` 수집 (`list_console_messages`) (보류 — CDP 연결 기능 일시 비활성화)
- [x] 연결 상태 + 디바이스 목록 확인 (`get_debugger_status`) ✅
- [x] Fiber 트리 기반 라벨 검색 (`get_by_label`, `click_by_label`, `list_clickables`) ✅
- [x] 다중 디바이스 지원 — N대 동시 연결, deviceId/platform 기반 라우팅 ✅
- [ ] 성능 모니터링

**산출물**: 프로덕션급 완성

---

## 6. 참고 자료

### 6.1 오픈소스

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

### 6.2 공식 문서

- Metro: https://metrobundler.dev/
- Babel Plugin Handbook: https://github.com/jamiebuilds/babel-handbook
- React Fiber Architecture: https://github.com/acdlite/react-fiber-architecture
- MCP Specification: https://modelcontextprotocol.io/

---

## 7. 리스크 & 제약사항

### 7.1 기술적 리스크

1. **React Fiber 내부 API 변경**
   - 완화: React DevTools 패턴 따르기

2. **Metro API 변경**
   - 완화: 공식 API 우선 사용

3. **성능 오버헤드**
   - 완화: 개발 모드 전용

4. **보안**
   - 완화: localhost만 허용, 프로덕션 제거

### 7.2 기능적 제약

1. **iOS 실기기 스크린샷** - simctl은 시뮬레이터 전용이라 실기기에서는 미지원
2. **가상화 목록 한계** - FlatList 미렌더링 아이템은 scroll 도구로 수동 스크롤 후 조회 가능하지만, 에이전트가 자동으로 전체 목록을 탐색하는 기능은 미구현
3. **서드파티 네이티브 컴포넌트** - 제어 어려움

### 7.3 현실적 접근

- **완벽 불필요**: Chrome MCP도 한계 존재
- **점진적 개선**: Phase 1만으로도 유용
- **커뮤니티 피드백**: 실제 사용 사례 반영

---

## 8. 성공 기준

### Phase 1 (MVP)

- [x] MCP 서버가 Cursor/Claude에서 인식
- [x] 앱에서 코드 실행 가능 (evaluate_script)
- [x] WebSocket 연결 안정 (12300)

### Phase 2

- [x] 컴포넌트 트리 조회 (take_snapshot, list_text_nodes)
- [x] testID로 컴포넌트 검색 (get_by_label, list_clickables)

### Phase 3

- [x] AI가 버튼 클릭 등 조작 (click, click_by_label, triggerPress)
- [x] 프로덕션 빌드에서 WebSocket 미연결 (`__DEV__` 체크, `MCP.enable()` 수동 활성화)
- [ ] Dead code elimination 검증

### Phase 4

- [x] AI가 화면 보고 판단 (take_screenshot)

### 최종

- [ ] Chrome MCP 수준 자동화 (RN 환경)
- [ ] npm 배포 가능 안정성
- [ ] 문서 및 예제 완비

---

## 9. 다음 단계

1. **Phase 3 보완**: set_props, Dead code elimination 검증
2. **Phase 5**: CDP 기반 네트워크/콘솔 모니터링 재활성화
3. **FlatList 가상화 자동 탐색**: 전체 목록 자동 스크롤 + 수집 기능
4. **안정화**: npm 배포, 문서 정비

이 설계는 실험적이며, 구현 중 발견되는 제약사항에 따라 수정 가능합니다.
