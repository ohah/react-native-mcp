# E2E 테스트 계획 (AI 없이 자동화)

> DESIGN.md 섹션 10 "프로그래매틱 테스트 러너"의 구체적 구현 계획.
> 현재 MCP 도구들을 AI 없이 프로그래밍 방식으로 사용할 수 있도록 하는 로드맵.

---

## 1. 현재 상태와 목표

### 1.1 현재 상태

MCP 도구 (`tap`, `type_text`, `assert_text` 등)는 완성되어 있으나, 사용하려면 **MCP 프로토콜(JSON-RPC over stdio)** 을 직접 다뤄야 한다:

```
[테스트 코드] → JSON-RPC → [MCP Server] → WebSocket → [React Native App]
```

AI 에이전트는 이 프로토콜을 자동으로 처리하지만, 일반 테스트 코드에서 쓰기엔 보일러플레이트가 많다.

**이미 구현된 것:**

- **E2E YAML 테스트**: `examples/demo-app/e2e/` 디렉터리의 YAML 스텝으로 실행. CI에서 `test run examples/demo-app/e2e/` 호출.
- **SDK (client)**: `createApp()`, `AppClient`로 MCP 도구 래핑. YAML 러너(`packages/react-native-mcp-server/src/test/runner.ts`)가 이 SDK를 사용해 스텝 실행.
- **CI 워크플로우**: GitHub Actions에서 iOS/Android 자동 E2E (`.github/workflows/e2e-ios.yml`, `e2e-android.yml`)
- **데모앱** (`examples/demo-app/`): 테스트용 다양한 화면 (Scroll, Input, WebView, Gesture 등)
- **딥링크 도구** (`open_deeplink`): MCP 도구로 구현 완료
  **현재 구현된 MCP 도구 (27개):**

| 카테고리      | 도구                                                                                           |
| ------------- | ---------------------------------------------------------------------------------------------- |
| 조회          | `take_snapshot`, `query_selector`, `query_selector_all`, `take_screenshot`, `describe_ui`      |
| Assertion     | `assert_text`, `assert_visible`                                                                |
| 입력          | `tap`, `swipe`, `input_text`, `type_text`, `input_key`, `press_button`                         |
| 실행          | `evaluate_script`, `webview_evaluate_script`                                                   |
| 디바이스      | `get_debugger_status`, `list_devices`, `switch_keyboard`                                       |
| 딥링크        | `open_deeplink`                                                                                |
| 네트워크/콘솔 | `list_console_messages`, `list_network_requests`, `clear`(target: console/network_requests 등) |
| 파일/미디어   | `file_push`, `add_media`                                                                       |

### 1.2 목표

```typescript
// 이렇게 쓸 수 있어야 함
const app = await createApp({ platform: 'ios' });
await app.typeText('#email', 'user@test.com');
await app.tap('Pressable:text("로그인")');
await app.waitForText('환영합니다', { timeout: 5000 });
```

---

## 2. 구현 단계

### Phase B·C·D 현황 요약

| Phase | MCP 도구 / 인프라                                                                              | SDK 래퍼 (client 패키지)                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **B** | ✅ `assert_text`/`assert_visible`/`assert_not_visible`에 `timeoutMs`/`intervalMs` polling 완료 | ✅ `waitForText`, `waitForVisible`, `waitForNotVisible`, `waitFor` 구현 완료                                    |
| **C** | ✅ `assert_not_visible`, `assert_element_count` 구현. YAML `assertValue` 지원                  | ✅ `assertNotVisible`, `assertCount`, `assertValue`, `assertNoText`, `assertEnabled`/`assertDisabled` 구현 완료 |
| **D** | ✅ `open_deeplink`, `clear_state` MCP 도구 완료. launch/terminate는 MCP 없이 Bash 사용         | ✅ `launch`, `terminate`, `clearState`, `resetApp` 구현 완료 (YAML 러너에서 사용)                               |

SDK(client 패키지)는 위 MCP 도구/인프라를 **동일한 기능으로 래핑**하여 `app.waitForText()`, `app.assertCount()` 등 타입 있는 메서드로 제공한다. YAML 러너는 이 SDK 메서드를 호출해 스텝을 실행한다.

---

### Phase 0: MCP 도구 레벨 Assertion 강화 (선행 조건) — ✅ 구현 완료

**목표**: CI/GitHub Actions에서 flaky test 없이 안정적 자동화를 위한 MCP 도구 레벨 polling 지원.

**왜 필요한가**: Phase B의 SDK 레벨 waitFor는 SDK를 사용하는 경우에만 동작한다. 그러나 AI 에이전트(Cursor, Claude Desktop)는 MCP 도구를 직접 호출하므로, **도구 자체에 polling이 내장**되어야 AI/SDK 모두 활용 가능하다. 또한 SDK의 `waitFor` 구현이 MCP 도구의 polling을 기반으로 하면 불필요한 라운드트립을 줄일 수 있다.

**비교 분석**: flutter-skill(https://github.com/ai-dashboad/flutter-skill)의 React Native SDK는 `assert_visible`/`assert_not_visible`에 `timeout` 파라미터를 내장하고 200ms 간격 polling을 수행. `wait_for_idle`(UI 안정성 대기)은 판단 기준 모호 → 채택하지 않음.

**구현 항목**:

| 도구                          | 변경 사항                              | 하위 호환                              |
| ----------------------------- | -------------------------------------- | -------------------------------------- |
| `assert_text`                 | `timeoutMs`/`intervalMs` 파라미터 추가 | `timeoutMs=0` 기본값 → 기존처럼 단발성 |
| `assert_visible`              | `timeoutMs`/`intervalMs` 파라미터 추가 | 동일                                   |
| `assert_not_visible` (신규)   | 요소 사라짐 확인 + polling             | -                                      |
| `scroll_until_visible` (신규) | swipe + querySelector 반복             | -                                      |
| `assert_element_count` (신규) | 요소 개수 확인 + polling               | -                                      |

**polling 동작**:

```
timeoutMs=0 (기본) → 즉시 체크, 즉시 반환 (기존 동작)
timeoutMs>0        → 체크 → 실패 시 intervalMs 후 재시도 → timeoutMs 초과 시 최종 반환
```

**구현 위치**: `runtime.js`에 공용 polling 함수 추가 + `assert.ts`에 파라미터 전달.

**상세 설계**: [DESIGN.md 섹션 14](./DESIGN.md#14-ci-ready-assertion--wait-도구-강화) 참조.

---

### Phase A: Programmatic Client SDK — ✅ 구현 완료

**목표**: MCP 프로토콜을 감싸서 함수 호출로 바로 쓸 수 있는 라이브러리.

**왜 필요한가**: 현재 도구를 호출하려면 MCP 클라이언트를 직접 생성하고, `client.callTool({ name: '...', arguments: {...} })` 형태로 호출해야 한다. SDK는 이 과정을 `app.tap('#btn')` 한 줄로 줄여준다.

> **참고**: SDK(client 패키지)가 MCP 호출을 `app.tap()`, `app.querySelector()` 등 타입 있는 메서드로 래핑하여 제공한다. YAML 러너는 이 SDK를 사용한다.

**패키지**: `packages/react-native-mcp-server/src/client`

**핵심 API 설계**:

```typescript
import { createApp, type AppClient } from '@ohah/react-native-mcp-server/client';

// 연결 (MCP 서버 자동 spawn + WebSocket 대기)
const app = await createApp({
  platform: 'ios', // 'ios' | 'android'
  deviceId: 'ios-1', // 선택: 다중 디바이스 시
  serverCommand: 'bun', // MCP 서버 실행 명령
  serverArgs: ['dist/index.js'],
});

// --- 조회 ---
const tree = await app.snapshot(); // take_snapshot
const el = await app.querySelector('#login-btn'); // query_selector
const els = await app.querySelectorAll('Text'); // query_selector_all
const screenshot = await app.screenshot(); // take_screenshot → Buffer

// --- 조작 ---
await app.tap('#login-btn'); // query_selector → measure → tap (좌표 기반)
await app.typeText('#email', 'user@test.com'); // type_text (uid 기반)
await app.swipe('#list', { direction: 'up' }); // query_selector → measure → swipe
await app.inputText('hello'); // input_text (포커스된 입력에 텍스트 전송)
await app.pressButton('BACK'); // press_button

// --- 딥링크 ---
await app.openDeepLink('myapp://screen/settings'); // open_deeplink

// --- WebView ---
await app.webviewEval('main-webview', 'document.title');

// --- 임의 JS 실행 ---
await app.evaluate('() => console.log("hello")');

// --- 디버깅 ---
const logs = await app.consoleLogs({ level: 'error' }); // list_console_messages
const requests = await app.networkRequests({ url: '/api' }); // list_network_requests

// --- 정리 ---
await app.close();
```

**내부 구조**:

```
AppClient
  ├── MCP Client (StdioClientTransport)
  │     └── spawn MCP Server subprocess
  ├── callTool() 래핑 → 각 메서드
  └── 결과 파싱 (JSON string → typed object)
```

**구현 범위**:

| 항목                    | 설명                                            |
| ----------------------- | ----------------------------------------------- |
| MCP 서버 자동 spawn     | `StdioClientTransport`로 서버 프로세스 생성     |
| 도구별 타입 안전 메서드 | 모든 MCP 도구를 타입이 있는 메서드로 노출       |
| 결과 파싱               | `content[0].text` → 파싱된 객체로 변환          |
| 에러 처리               | MCP 에러 → 읽기 좋은 Error 객체로 변환          |
| 연결 대기               | 앱 WebSocket 연결 완료까지 대기 (타임아웃 포함) |

---

### Phase B: Wait / Retry 메커니즘 — ✅ 구현 완료

**목표**: 비동기 UI 변화를 안정적으로 기다리는 유틸리티.

**현황**: MCP 도구 레벨에서 `assert_text`/`assert_visible`/`assert_not_visible`에 `timeoutMs`/`intervalMs` polling 지원 완료. **SDK 래퍼**(`waitForText`, `waitForVisible`, `waitForNotVisible`, `waitFor`)도 client 패키지에 구현되어 있으며, YAML 러너가 이를 호출한다.

**왜 필요한가**: AI는 실패하면 스크린샷을 보고 판단 후 재시도하지만, 자동화에서는 "이 텍스트가 나올 때까지 기다려" 같은 명시적 대기 조건이 필수다. 이게 없으면 테스트가 타이밍에 따라 성공/실패가 갈린다 (flaky test).

> **Phase 0과의 관계**: Phase 0에서 MCP 도구 레벨에 polling이 추가되므로, SDK의 waitFor는 내부적으로 `assert_text({ timeoutMs })` / `assert_visible({ timeoutMs })`를 호출하는 래퍼가 된다. MCP 라운드트립 1회로 polling이 완료되므로 SDK에서 반복 호출하는 것보다 효율적.

**API**:

```typescript
// 텍스트 대기
await app.waitForText('환영합니다', { timeout: 5000, interval: 300 });

// 요소 대기
await app.waitForVisible('#home-screen', { timeout: 3000 });

// 요소 사라짐 대기
await app.waitForNotVisible('#loading-spinner', { timeout: 10000 });

// 커스텀 조건 대기
await app.waitFor(
  async () => {
    const els = await app.querySelectorAll('.item');
    return els.length >= 5;
  },
  { timeout: 5000 }
);
```

**내부 동작** (공통 패턴):

```
function waitFor(predicate, { timeout, interval }) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await predicate()) return;
    await sleep(interval);
  }
  throw new TimeoutError(`${timeout}ms 초과`);
}
```

**기본값**:

| 옵션       | 기본값 | 설명           |
| ---------- | ------ | -------------- |
| `timeout`  | 5000ms | 최대 대기 시간 |
| `interval` | 300ms  | 폴링 간격      |

---

### Phase C: 추가 Assertion 도구 — ✅ 구현 완료

**목표**: 테스트 표현력을 높이는 assertion 확장.

**현황**: MCP 도구 `assert_not_visible`, `assert_element_count` 구현 완료. YAML 스텝 `assertValue` 지원. **SDK 래퍼**(`assertNotVisible`, `assertCount`, `assertValue`, `assertNoText`, `assertEnabled`/`assertDisabled`)도 client 패키지에 구현되어 있으며, YAML 러너가 이를 호출한다.

**왜 필요한가**: 현재 `assert_text`와 `assert_visible` 2개뿐이다. "이 요소가 없어야 한다", "TextInput 값이 뭔지", "요소가 몇 개인지" 같은 검증은 할 수 없다.

**구현 방식**: SDK 레벨 (MCP 도구 추가 없이 기존 도구 조합)

```typescript
// 요소 부재 확인
await app.assertNotVisible('#deleted-item');
// → querySelectorAll('#deleted-item') 결과가 0개인지 확인

// 요소 개수 확인
await app.assertCount('View.card', 3);
// → querySelectorAll('View.card').length === 3

// TextInput 값 확인
await app.assertValue('#email', 'user@test.com');
// → querySelector('#email') → props.value 확인

// 텍스트 부재 확인
await app.assertNoText('에러');
// → snapshot 에서 '에러' 포함 여부 확인

// 활성/비활성 상태 확인
await app.assertEnabled('#submit-btn');
await app.assertDisabled('#submit-btn');
// → querySelector → props.disabled 확인
```

**전체 Assertion 목록**:

| 메서드                         | 내부 구현                         | 용도        |
| ------------------------------ | --------------------------------- | ----------- |
| `assertText(text, selector?)`  | MCP `assert_text`                 | 텍스트 존재 |
| `assertNoText(text)`           | `take_snapshot` + 검사            | 텍스트 부재 |
| `assertVisible(selector)`      | MCP `assert_visible`              | 요소 존재   |
| `assertNotVisible(selector)`   | `querySelectorAll` + 0개 확인     | 요소 부재   |
| `assertCount(selector, n)`     | `querySelectorAll` + length       | 요소 개수   |
| `assertValue(selector, value)` | `querySelector` + props.value     | Input 값    |
| `assertEnabled(selector)`      | `querySelector` + !props.disabled | 활성 상태   |
| `assertDisabled(selector)`     | `querySelector` + props.disabled  | 비활성 상태 |

---

### Phase D: 앱 생명주기 관리 — ✅ 구현 완료

**목표**: 테스트 간 앱 상태 격리.

**왜 필요한가**: AI는 현재 화면 상태를 보고 적응하지만, 자동화에서는 **매 테스트가 동일한 초기 상태**에서 시작해야 한다. 그렇지 않으면 이전 테스트의 상태가 다음 테스트에 영향을 준다.

**현재 구현 상태:**

| 기능                       | 상태          | 구현 방식                                                                  |
| -------------------------- | ------------- | -------------------------------------------------------------------------- |
| `open_deeplink`            | **구현 완료** | MCP 도구 (`open-deeplink.ts`)                                              |
| `clearState` (상태 초기화) | **구현 완료** | MCP 도구 `clear_state` + SDK `app.clearState()`                            |
| `launch` / `terminate`     | **구현 완료** | MCP 도구 없음. SDK에서 adb/simctl 래핑 (`app.launch()`, `app.terminate()`) |
| `resetApp`                 | **구현 완료** | SDK `app.resetApp()` (terminate → clearState → launch)                     |

> **결정 사항**: launch/terminate는 MCP 도구 없이 Bash(simctl/adb)로 실행. SDK 래퍼 `launch`, `terminate`, `clearState`, `resetApp`은 client 패키지에 구현되어 있으며, YAML 러너에서 사용 가능하다.

**API**:

```typescript
// 딥링크 (MCP 도구 — 이미 구현됨)
await app.openDeepLink('myapp://screen/settings');
// → MCP open_deeplink 도구 호출

// 앱 실행 (SDK에서 adb/simctl 래핑)
await app.launch('com.example.myapp');
// Android: adb shell am start -n com.example.myapp/.MainActivity
// iOS: xcrun simctl launch booted com.example.myapp

// 앱 종료 (SDK에서 adb/simctl 래핑)
await app.terminate('com.example.myapp');
// Android: adb shell am force-stop com.example.myapp
// iOS: xcrun simctl terminate booted com.example.myapp

// 앱 데이터 초기화 (MCP clear_state 도구 호출)
await app.clearState('com.example.myapp');

// 상태 리셋 (종료 → clearState → 재실행)
await app.resetApp('com.example.myapp');
```

---

### Phase E: YAML 테스트 러너 + CLI — 구현 완료 ✅

**목표**: 코드 작성 없이 YAML로 E2E 테스트 정의 및 실행.

**현황**: `npx @ohah/react-native-mcp-server test run <path>` CLI 및 YAML 파서/러너 구현 완료. runFlow, repeat, if/retry, 환경 변수 등 지원.

**YAML 스키마**:

```yaml
name: 로그인 플로우
config:
  platform: ios
  timeout: 10000 # 글로벌 타임아웃

setup: # 테스트 전 실행
  - launch: com.example.myapp
  - waitForVisible: '#login-screen'

steps:
  - typeText:
      selector: '#email'
      text: 'user@example.com'

  - typeText:
      selector: '#password'
      text: 'secret123'

  - tap:
      selector: 'Pressable:text("로그인")'

  - waitForText:
      text: '환영합니다'
      timeout: 5000

  - assertVisible:
      selector: '#home-screen'

  - assertNotVisible:
      selector: '#login-screen'

  - screenshot:
      path: './results/login-success.png'

teardown: # 테스트 후 실행
  - terminate: com.example.myapp
```

**지원 액션 목록**:

| 액션                | 파라미터                             | 설명                                            |
| ------------------- | ------------------------------------ | ----------------------------------------------- |
| `tap`               | `selector`                           | 요소 탭 (selector → 좌표)                       |
| `swipe`             | `selector`, `direction`, `distance?` | 스와이프 (distance: 숫자=dp, `'50%'`=요소 비율) |
| `typeText`          | `selector`, `text`                   | 텍스트 입력 (uid 기반)                          |
| `inputText`         | `text`                               | 포커스된 입력에 텍스트 전송                     |
| `pressButton`       | `button`                             | 물리 버튼 (HOME, BACK 등)                       |
| `waitForText`       | `text`, `timeout?`                   | 텍스트 대기                                     |
| `waitForVisible`    | `selector`, `timeout?`               | 요소 출현 대기                                  |
| `waitForNotVisible` | `selector`, `timeout?`               | 요소 사라짐 대기                                |
| `assertText`        | `text`, `selector?`                  | 텍스트 확인                                     |
| `assertVisible`     | `selector`                           | 요소 존재 확인                                  |
| `assertNotVisible`  | `selector`                           | 요소 부재 확인                                  |
| `assertCount`       | `selector`, `count`                  | 요소 개수 확인                                  |
| `screenshot`        | `path?`                              | 스크린샷 저장                                   |
| `wait`              | `ms`                                 | 고정 대기 (비추천)                              |
| `launch`            | `bundleId`                           | 앱 실행                                         |
| `terminate`         | `bundleId`                           | 앱 종료                                         |
| `openDeepLink`      | `url`                                | 딥링크 열기                                     |
| `evaluate`          | `script`                             | 임의 JS 실행                                    |

**CLI**:

```bash
# 단일 테스트 실행
npx react-native-mcp-server test run tests/login.yaml

# 디렉토리 내 전체 실행
npx react-native-mcp-server test run tests/

# 플랫폼 지정
npx react-native-mcp-server test run tests/ --platform android

# 리포트 출력
npx react-native-mcp-server test run tests/ --reporter junit --output results/
```

---

### Phase F: 테스트 리포트 & CI 통합 — 완료

**목표**: CI 파이프라인에서 사용 가능한 결과 출력.

> **참고**: CI에서는 bun test + GitHub Actions artifact 업로드 방식으로 리포트가 동작한다. 실패 시 스크린샷과 로그(logcat/simulator log)가 자동 수집됨.

**리포터 종류**:

| 리포터           | 출력                      | 용도                                       |
| ---------------- | ------------------------- | ------------------------------------------ |
| `console` (기본) | 터미널 컬러 출력          | 로컬 개발                                  |
| `junit`          | JUnit XML                 | GitHub Actions, Jenkins 등                 |
| `json`           | JSON 파일                 | 커스텀 대시보드                            |
| `html`           | report.html               | 스크린샷 포함 시각적 리포트, 브라우저 확인 |
| `slack`          | Slack 웹훅 전송           | 팀 알림 (실패 시 상세·스크린샷 경로)       |
| `github-pr`      | PR 코멘트 / pr-comment.md | CI에서 PR에 결과 자동 코멘트               |

**리포터 확인 방법**: HTML은 실행 후 `output/report.html` 브라우저로 열기, Slack은 채널 도착 여부 확인, GitHub PR은 PR 코멘트 또는 `output/pr-comment.md` 확인. 자세한 사용법·옵션은 [e2e-yaml-reference.md](e2e-yaml-reference.md)의 CLI·리포터 섹션 참고.

**Console 리포터 출력 예시**:

```
✓ 로그인 플로우 (3.2s)
  ✓ typeText #email
  ✓ typeText #password
  ✓ tap 로그인
  ✓ waitForText 환영합니다
  ✓ assertVisible #home-screen

✗ 회원가입 플로우 (5.1s)
  ✓ tap 회원가입
  ✗ waitForText 가입 완료 (TimeoutError: 5000ms 초과)
    📸 Screenshot saved: results/회원가입-failure.png

Results: 1 passed, 1 failed (8.3s)
```

실패 후 뒤 스텝이 건너뛰어지면 `N skipped`도 출력된다. 예: `Results: 2 passed, 1 failed, 3 skipped (8.3s)`. 자세한 집계 규칙은 [e2e-yaml-reference.md](e2e-yaml-reference.md)의 "실행 결과 (RunResult)" 참고.

**실패 시 자동 동작**:

1. 스크린샷 자동 캡처 → `results/{테스트명}-failure.png`
2. Fiber 트리 스냅샷 저장 → `results/{테스트명}-snapshot.json`
3. 실패 스텝 및 에러 메시지 기록

**CI 설정 예시 (GitHub Actions)**:

```yaml
- name: Run E2E Tests
  run: npx react-native-mcp-server test run tests/ --reporter junit --output results/

- name: Upload Results
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: e2e-results
    path: results/
```

---

## 3. 현재 진행 상황 및 우선순위

### 진행 상황 요약

```
기초 인프라 (완료):
  ├── E2E YAML 테스트 (examples/demo-app/e2e/) — CI에서 test run으로 실행
  ├── CI 워크플로우 (iOS + Android GitHub Actions)
  ├── SDK (client) + YAML 러너 (test/runner.ts)
  └── 데모앱 (examples/demo-app/)

Phase D 완료:
  ├── open_deeplink MCP 도구 ✅
  ├── clear_state MCP 도구 ✅
  └── SDK: launch/terminate/clearState/resetApp ✅

Phase 0 완료:
  ├── assert_text / assert_visible: timeoutMs/intervalMs 폴링 추가 ✅
  ├── assert_not_visible: 신규 도구 ✅
  ├── assert_element_count: 신규 도구 ✅
  └── scroll_until_visible: 신규 도구 ✅

Phase A 완료:
  ├── @ohah/react-native-mcp-server/client 패키지 ✅
  ├── AppClient: 28개 MCP 도구 타입 래퍼 ✅
  ├── 편의 메서드: tap/swipe/typeText(selector), waitFor* ✅
  └── createApp() 팩토리 + 서버 자동 spawn ✅

Phase B~D 완료:
  ├── Phase B: waitForText/waitForVisible/waitForNotVisible ✅
  ├── Phase C: assertCount/assertValue/assertEnabled/assertDisabled 등 ✅
  └── Phase D: launch/terminate/resetApp SDK 래핑 ✅

Phase E+F 완료:
  ├── @ohah/react-native-mcp-server/test 패키지 ✅
  ├── YAML 파싱 + Zod 검증 (parser.ts) ✅
  ├── 실행 엔진 (runner.ts) — setup/steps/teardown, 실패 시 스크린샷 자동 캡처 ✅
  ├── CLI (cli.ts) — run <path> --platform --reporter --output ✅
  └── 리포터: console, junit, json, html, slack, github-pr ✅
```

### 의존 관계

```
Phase 0: MCP Assertion 강화 ─┐
                              ├→ Phase A: SDK ──────────┐
                              │                         ├→ Phase B: Wait/Retry ──┐
                              │                         ├→ Phase C: Assertions   ├→ Phase E: YAML 러너 → Phase F: CI 리포트
                              │                         └→ Phase D: SDK 래핑 ────┘
                              │
                              └→ (AI 에이전트가 바로 활용 가능)
```

| Phase | 이름                    | 선행 조건 | 상태        | 예상 규모                                                                         |
| ----- | ----------------------- | --------- | ----------- | --------------------------------------------------------------------------------- |
| 기초  | E2E YAML + CI           | 없음      | **완료**    | examples/demo-app/e2e/ + test run + CI yml                                        |
| **0** | MCP Assertion 강화      | 없음      | **✅ 완료** | assert.ts 폴링 + assert_not_visible + assert_element_count + scroll_until_visible |
| **A** | Programmatic Client SDK | 없음      | **✅ 완료** | `@ohah/react-native-mcp-server/client` 패키지, ~280줄                             |
| **B** | Wait/Retry              | 0 + A     | **✅ 완료** | waitForText/waitForVisible/waitForNotVisible/waitFor                              |
| **C** | 추가 Assertions         | 0 + A     | **✅ 완료** | assertCount/assertValue/assertEnabled/assertDisabled 등                           |
| **D** | 앱 생명주기 관리        | A         | **✅ 완료** | launch/terminate/resetApp + openDeepLink                                          |
| **E** | YAML 러너 + CLI         | A + B + C | **✅ 완료** | `@ohah/react-native-mcp-server/test` 패키지                                       |
| **F** | CI 리포트               | E         | **✅ 완료** | console / junit / json / html / slack / github-pr 리포터                          |

**Phase 0~F 전부 완료** → YAML로 E2E 테스트 작성 + CLI 실행 + CI 리포트 가능.

### 알려진 이슈

| 이슈                                | 상태       | 설명                                                                                                                   |
| ----------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------- |
| bun + ws message 미발생             | **우회**   | `bun`으로 MCP 서버 실행 시 `ws` 라이브러리 message 이벤트 미발생. `serverCommand: 'node'`로 변경하여 우회 (Bun v1.3.9) |
| iPad 시뮬레이터 tap 후 Count 미증가 | **미해결** | `tap(selector)` 호출 성공하지만 실제 터치가 반영되지 않음. 좌표 계산 또는 iPad 해상도 문제 추정                        |

---

## 4. 기존 E2E 도구와의 비교

| 항목                 | Detox         | Maestro        | Appium    | **MCP E2E**             |
| -------------------- | ------------- | -------------- | --------- | ----------------------- |
| 네이티브 모듈 필요   | Yes           | No (별도 서버) | Yes       | **No**                  |
| iOS/Android 통합 API | Yes           | Yes            | Yes       | **Yes** (Fiber)         |
| 셀렉터               | testID, label | label, id      | XPath, id | **Fiber 셀렉터**        |
| 설치 복잡도          | 높음          | 중간           | 높음      | **낮음** (Babel만)      |
| AI 에이전트 연동     | 없음          | 없음           | 없음      | **네이티브 지원**       |
| 네이티브 제스처      | 완전 지원     | 완전 지원      | 완전 지원 | **tap/swipe** (섹션 12) |
| WebView 제어         | 제한적        | 제한적         | 지원      | **JS 실행 가능**        |
| 테스트 작성 방식     | JS/TS         | YAML           | 다양      | **JS/TS + YAML**        |

**MCP E2E의 차별점**: 동일한 도구를 AI 에이전트와 자동화 테스트가 공유한다. AI가 탐색적 테스트를 하고, 안정화된 시나리오를 YAML/스크립트로 전환하는 워크플로우가 가능하다.

---

## 5. 미결정 사항

| 항목             | 선택지                                         | 결정 시점       |
| ---------------- | ---------------------------------------------- | --------------- |
| SDK 패키지 위치  | 모노레포 내 새 패키지 vs 서버 패키지 내 export | Phase A 시작 시 |
| YAML 스키마 표준 | 자체 정의 vs Maestro 호환                      | Phase E 시작 시 |
| bun test 통합    | bun test matcher 제공 여부                     | Phase C 이후    |
| 병렬 테스트 실행 | 다중 디바이스 활용 병렬 실행 지원 여부         | Phase F 이후    |
