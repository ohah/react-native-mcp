# React Native MCP 서버 설계 문서

React Native 앱 자동화·모니터링을 위한 MCP 서버 설계. Chrome DevTools MCP와 유사하지만 DOM이 없는 React Native 환경에 맞춰 Metro + Babel + Fiber tree 기반으로 구축.

---

## 1. 개요

### 1.1 목표

React Native 앱을 AI가 제어하고 모니터링할 수 있도록 MCP 서버 구축:

- **컴포넌트 조회**: DOM 대신 React Fiber tree 활용
- **자동화**: testID 기반 컴포넌트 선택 및 조작
- **모니터링**: 네트워크, 로그, 상태 추적
- **시각적 피드백**: 네이티브 스크린샷

### 1.2 Chrome MCP와의 차이점

| 항목      | Chrome MCP            | React Native MCP       |
| --------- | --------------------- | ---------------------- |
| 구조 파악 | DOM tree              | React Fiber tree       |
| 선택자    | CSS selector          | testID, component path |
| 조작      | querySelector + click | Fiber + event trigger  |
| 스냅샷    | HTML snapshot         | Component tree JSON    |
| 스크린샷  | CDP screenshot        | Native module          |
| 통신      | CDP (WebSocket)       | WebSocket + eval       |
| 코드 주입 | 불필요                | Babel/Metro 필수       |

### 1.3 핵심 전략

1. **Metro 번들러**: 컴포넌트 구조 파악 및 런타임 코드 자동 주입
2. **Babel Plugin**: AST 변환으로 개발 모드 추적 코드 삽입
3. **React Fiber Hook**: 런타임 컴포넌트 트리 추적 (React DevTools 방식)
4. **WebSocket**: MCP 서버 ↔ 앱 양방향 통신
5. **Native Module**: 스크린샷 전용 (최소화)

---

## 2. 기술적 가능성 분석

### 2.1 ✅ 확실히 가능한 부분

#### Metro Plugin

- Metro는 `transformer`, `serializer`, `resolver` 커스터마이징 지원
- `metro.config.js`로 플러그인 추가
- 런타임 코드 자동 번들링
- **참고**: Flipper Metro 플러그인

#### Babel Plugin

- AST 변환으로 컴포넌트 코드 주입
- `__DEV__` 플래그로 프로덕션 자동 제거
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

#### Native Screenshot

- iOS: `UIGraphicsImageRenderer`
- Android: `View.drawToBitmap()`
- **참고**: `react-native-view-shot` 라이브러리

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

**해결책**:

- Fiber tree의 virtualized node 추적
- `scrollToIndex()` API로 강제 렌더링
- Metro 번들 정보로 전체 구조 파악

#### Modal/Overlay 추적

**문제**: 네이티브 레이어 가능성

**해결책**:

- Babel로 Modal 컴포넌트 래핑
- RN의 Modal은 JS 컴포넌트
- `AppRegistry` 훅으로 추적

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

```
react-native-mcp/
├── packages/
│   ├── server/              # MCP 서버 (PC에서 실행)
│   ├── metro-plugin/        # Metro 번들러 플러그인
│   ├── babel-plugin/        # Babel AST 변환 플러그인
│   ├── runtime/             # 앱에 자동 주입되는 런타임 코드
│   └── native-snapshot/     # 스크린샷 네이티브 모듈
├── examples/
│   └── demo-app/            # 테스트용 RN 앱
└── docs/
    └── DESIGN.md            # 이 문서
```

### 3.2 데이터 흐름

```
┌─────────────────────────────────────────────────┐
│  Cursor / Claude Desktop / Copilot CLI          │
└───────────────────┬─────────────────────────────┘
                    │ stdio (MCP protocol)
┌───────────────────▼─────────────────────────────┐
│  MCP Server (packages/server)                   │
│  - Tools: get_component_tree, eval_code, etc.   │
│  - WebSocket Server (ws://localhost:9223)       │
└───────────────────┬─────────────────────────────┘
                    │ WebSocket
┌───────────────────▼─────────────────────────────┐
│  React Native App (iOS/Android)                 │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │  Runtime (packages/runtime)            │     │
│  │  - WebSocket Client                    │     │
│  │  - Fiber Hook                          │     │
│  │  - Eval Bridge                         │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │  Babel Plugin 주입 코드                │     │
│  │  - Auto testID                         │     │
│  │  - Component tracking                  │     │
│  └────────────────────────────────────────┘     │
│                                                  │
│  ┌────────────────────────────────────────┐     │
│  │  Native Screenshot Module              │     │
│  └────────────────────────────────────────┘     │
└──────────────────────────────────────────────────┘
```

### 3.3 빌드 파이프라인

```
개발 모드:
Source Code
  ↓ Babel Plugin (testID 주입, 추적 코드)
  ↓ Metro Transformer (runtime 자동 번들링)
  ↓
Bundle (with runtime + tracking)
  ↓
App 실행 → WebSocket 연결 → MCP 제어 가능

프로덕션 빌드:
Source Code
  ↓ Babel Plugin (__DEV__ = false, 코드 주입 skip)
  ↓ Metro Transformer (runtime 제외)
  ↓
Bundle (clean, no MCP code)
  ↓
App 실행 → MCP 코드 완전 제거됨
```

---

## 4. 패키지 상세 스펙

### 4.1 packages/server

**역할**: MCP 프로토콜 서버 + WebSocket 서버

**의존성**:

- `@modelcontextprotocol/sdk` - MCP 서버/트랜스포트
- `ws` - WebSocket 서버
- `zod` - 파라미터 검증

**주요 파일**:

```
packages/server/
├── src/
│   ├── index.ts              # 진입점 (stdio transport)
│   ├── websocket-server.ts   # WS 서버 (앱 연결)
│   ├── tools/
│   │   ├── index.ts          # 도구 등록
│   │   ├── component-tree.ts # get_component_tree
│   │   ├── eval-code.ts      # eval_code
│   │   ├── screenshot.ts     # take_screenshot
│   │   └── ...
│   └── utils/
└── scripts/
    └── chmod-dist.mjs        # 빌드 후 실행 권한
```

**제공 Tools** (예정):

- `get_component_tree` - Fiber tree 조회
- `find_component` - testID/경로로 검색
- `eval_code` - 앱에서 코드 실행
- `click_component` - 컴포넌트 클릭
- `set_props` - props 변경
- `take_screenshot` - 스크린샷
- `list_network_requests` - 네트워크 로그
- `get_console_logs` - 콘솔 로그

### 4.2 packages/metro-plugin

**역할**: Metro 번들러 커스터마이징

**기능**:

1. **Runtime 자동 번들링**: 앱 진입점에 runtime 코드 자동 삽입
2. **HMR 확장**: MCP WebSocket과 통합
3. **소스맵 관리**: 디버깅용
4. **번들 메타데이터 수집**: 컴포넌트 구조 정보

**사용법**:

```js
// metro.config.js
const { withReactNativeMCP } = require('@ohah/react-native-mcp-metro-plugin');

module.exports = withReactNativeMCP({
  // 기존 Metro 설정
});
```

### 4.3 packages/babel-plugin

**역할**: AST 변환으로 코드 주입

**주입 대상**:

1. **자동 testID**: 모든 컴포넌트에 고유 ID
2. **추적 코드**: render, state change 이벤트
3. **Modal 래핑**: Modal 컴포넌트 감지

**변환 예시**:

```jsx
// Before (원본 코드)
function MyButton({ title }) {
  return (
    <TouchableOpacity>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}

// After (개발 모드, Babel 변환 후)
function MyButton({ title }) {
  if (__DEV__) {
    __REACT_NATIVE_MCP__.trackComponent('MyButton', this);
  }
  return (
    <TouchableOpacity testID="MyButton-0-TouchableOpacity">
      <Text testID="MyButton-0-Text">{title}</Text>
    </TouchableOpacity>
  );
}

// After (프로덕션 빌드, __DEV__ = false)
function MyButton({ title }) {
  return (
    <TouchableOpacity>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}
```

**사용법**:

```js
// babel.config.js
module.exports = {
  plugins: ['@ohah/react-native-mcp-babel-plugin'],
};
```

### 4.4 packages/runtime

**역할**: 앱에 자동 주입되는 최소한의 런타임 코드

**주요 모듈**:

#### websocket.ts

- MCP 서버 WebSocket 연결
- 재연결 로직 (지수 백오프)
- 메시지 송수신

#### fiber-hook.ts

- React Fiber tree 훅
- `__REACT_DEVTOOLS_GLOBAL_HOOK__` 패턴
- 컴포넌트 직렬화

#### eval-bridge.ts

- 원격 코드 실행
- HMR 메시지 리스너 확장
- 안전성 체크 (개발 모드만)

**초기화 코드**:

```ts
// 앱 진입점에 Metro가 자동 삽입
if (__DEV__) {
  require('@ohah/react-native-mcp-runtime').initialize({
    serverUrl: 'ws://localhost:9223',
  });
}
```

**프로덕션 처리**:

- `__DEV__` = false 시 모든 코드 no-op
- Dead code elimination으로 완전 제거
- 번들 크기 영향 없음

### 4.5 packages/native-snapshot

**역할**: 스크린샷 캡처 네이티브 모듈

**플랫폼 구현**:

#### iOS (Swift/Objective-C)

```swift
@objc(RNMCPSnapshot)
class RNMCPSnapshot: NSObject {
  @objc func captureScreen(
    _ resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    // UIGraphicsImageRenderer
    // Base64 인코딩 반환
  }
}
```

#### Android (Kotlin/Java)

```kotlin
class RNMCPSnapshotModule(reactContext: ReactApplicationContext)
  : ReactContextBaseJavaModule(reactContext) {

  @ReactMethod
  fun captureScreen(promise: Promise) {
    // View.drawToBitmap()
    // Base64 인코딩 반환
  }
}
```

**JS 인터페이스**:

```ts
import { NativeModules } from 'react-native';

const { RNMCPSnapshot } = NativeModules;

// 사용
const base64Image = await RNMCPSnapshot.captureScreen();
```

---

## 5. 구현 단계 (Phase별)

### Phase 1: 기본 인프라 ✨ (MVP)

**목표**: WebSocket + eval로 기본 제어 가능

**구현**:

- [ ] MCP 서버 기본 구조
  - [ ] stdio transport 구현
  - [ ] WebSocket 서버 추가 (ws://localhost:9223)
  - [ ] 기본 도구 1개: `eval_code`
- [ ] Runtime 패키지
  - [ ] WebSocket 클라이언트
  - [ ] eval bridge 구현
  - [ ] `__DEV__` 플래그 처리
- [ ] Metro Plugin 기본
  - [ ] runtime 자동 주입
  - [ ] HMR 통합

- [ ] 테스트
  - [ ] 데모 앱 생성
  - [ ] MCP로 코드 실행 확인

**산출물**: AI가 앱에서 임의 코드 실행 가능

### Phase 2: Component Tree 읽기

**목표**: 컴포넌트 구조 파악

**구현**:

- [ ] Fiber Hook 구현
  - [ ] `__REACT_DEVTOOLS_GLOBAL_HOOK__` 패턴 연구
  - [ ] Fiber tree 순회 함수
  - [ ] 컴포넌트 정보 직렬화 (name, props, state)
- [ ] MCP Tools 추가
  - [ ] `get_component_tree` - 전체 트리 반환
  - [ ] `find_component` - testID/이름 검색
- [ ] Metro Plugin 확장
  - [ ] 컴포넌트 메타데이터 수집
  - [ ] 소스맵 연동

**산출물**: AI가 렌더링된 컴포넌트 목록 조회

### Phase 3: Babel 코드 주입

**목표**: 자동 testID 및 추적 코드

**구현**:

- [ ] Babel Plugin 개발
  - [ ] AST visitor 구현
  - [ ] 컴포넌트 감지 (JSX)
  - [ ] testID 자동 생성 및 주입
  - [ ] 추적 코드 삽입
- [ ] 프로덕션 제거 로직
  - [ ] `__DEV__` 조건부 컴파일
  - [ ] Dead code elimination 검증
- [ ] MCP Tools 추가
  - [ ] `click_component` - testID로 onPress 트리거
  - [ ] `set_props` - props 변경

**산출물**: AI가 컴포넌트 선택 및 조작

### Phase 4: Native Screenshot

**목표**: 시각적 피드백

**구현**:

- [ ] Native Module 개발
  - [ ] iOS: Swift 구현
  - [ ] Android: Kotlin 구현
  - [ ] Base64 인코딩
- [ ] MCP Tool 추가
  - [ ] `take_screenshot` - 전체 화면
- [ ] 최적화
  - [ ] 압축 옵션
  - [ ] 크기 조절

**산출물**: AI가 화면 보고 판단

### Phase 5: 고급 기능

**목표**: Modal, FlatList 등

**구현**:

- [ ] Modal 추적
- [ ] FlatList 가상화 처리
- [ ] 네트워크 모니터링
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

1. **완벽한 스크린샷 불가** - 네이티브 뷰 일부 누락 가능
2. **가상화 목록 한계** - FlatList 미렌더링 아이템 접근 어려움
3. **서드파티 네이티브 컴포넌트** - 제어 어려움

### 7.3 현실적 접근

- **완벽 불필요**: Chrome MCP도 한계 존재
- **점진적 개선**: Phase 1만으로도 유용
- **커뮤니티 피드백**: 실제 사용 사례 반영

---

## 8. 성공 기준

### Phase 1 (MVP)

- [ ] MCP 서버가 Cursor/Claude에서 인식
- [ ] 앱에서 코드 실행 가능
- [ ] WebSocket 연결 안정

### Phase 2

- [ ] 컴포넌트 트리 조회
- [ ] testID로 컴포넌트 검색

### Phase 3

- [ ] AI가 버튼 클릭 등 조작
- [ ] 프로덕션 빌드에서 코드 완전 제거

### Phase 4

- [ ] AI가 화면 보고 판단

### 최종

- [ ] Chrome MCP 수준 자동화 (RN 환경)
- [ ] npm 배포 가능 안정성
- [ ] 문서 및 예제 완비

---

## 9. 다음 단계

1. **Phase 1 구현 시작**
2. **데모 앱 생성**
3. **반복 테스트**
4. **피드백 반영**

이 설계는 실험적이며, 구현 중 발견되는 제약사항에 따라 수정 가능합니다.
