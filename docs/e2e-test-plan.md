# E2E 테스트 계획 (AI 없이 자동화)

> DESIGN.md 섹션 10 "프로그래매틱 테스트 러너"의 구체적 구현 계획.
> 현재 MCP 도구들을 AI 없이 프로그래밍 방식으로 사용할 수 있도록 하는 로드맵.

---

## 1. 현재 상태와 목표

### 1.1 현재 상태

MCP 도구 (`click`, `type_text`, `assert_text` 등)는 완성되어 있으나, 사용하려면 **MCP 프로토콜(JSON-RPC over stdio)** 을 직접 다뤄야 한다:

```
[테스트 코드] → JSON-RPC → [MCP Server] → WebSocket → [React Native App]
```

AI 에이전트는 이 프로토콜을 자동으로 처리하지만, 일반 테스트 코드에서 쓰기엔 보일러플레이트가 많다.

### 1.2 목표

```typescript
// 이렇게 쓸 수 있어야 함
const app = await createApp({ platform: 'ios' });
await app.typeText('#email', 'user@test.com');
await app.click('Pressable:text("로그인")');
await app.waitForText('환영합니다', { timeout: 5000 });
```

---

## 2. 구현 단계

### Phase A: Programmatic Client SDK

**목표**: MCP 프로토콜을 감싸서 함수 호출로 바로 쓸 수 있는 라이브러리.

**왜 필요한가**: 현재 도구를 호출하려면 MCP 클라이언트를 직접 생성하고, `client.callTool({ name: '...', arguments: {...} })` 형태로 호출해야 한다. SDK는 이 과정을 `app.click('#btn')` 한 줄로 줄여준다.

**패키지**: `packages/react-native-mcp-client` (새 패키지)

**핵심 API 설계**:

```typescript
import { createApp, type AppClient } from '@ohah/react-native-mcp-client';

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
const texts = await app.listTextNodes(); // list_text_nodes
const clickables = await app.listClickables(); // list_clickables
const screenshot = await app.screenshot(); // take_screenshot → Buffer

// --- 조작 ---
await app.click('#login-btn'); // click (testID)
await app.clickByLabel('로그인'); // click_by_label
await app.longPress('#item'); // long_press
await app.longPressByLabel('삭제'); // long_press_by_label
await app.typeText('#email', 'user@test.com'); // type_text
await app.scroll('#list', { y: 300 }); // scroll

// --- WebView ---
await app.webviewEval('main-webview', 'document.title');

// --- 임의 JS 실행 ---
await app.evaluate(() => console.log('hello'));

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

### Phase B: Wait / Retry 메커니즘

**목표**: 비동기 UI 변화를 안정적으로 기다리는 유틸리티.

**왜 필요한가**: AI는 실패하면 스크린샷을 보고 판단 후 재시도하지만, 자동화에서는 "이 텍스트가 나올 때까지 기다려" 같은 명시적 대기 조건이 필수다. 이게 없으면 테스트가 타이밍에 따라 성공/실패가 갈린다 (flaky test).

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

### Phase C: 추가 Assertion 도구

**목표**: 테스트 표현력을 높이는 assertion 확장.

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
// → listTextNodes() 에서 '에러' 포함 여부 확인

// 활성/비활성 상태 확인
await app.assertEnabled('#submit-btn');
await app.assertDisabled('#submit-btn');
// → querySelector → props.disabled 확인
```

**전체 Assertion 목록**:

| 메서드                         | 내부 구현                         | 용도        |
| ------------------------------ | --------------------------------- | ----------- |
| `assertText(text, selector?)`  | MCP `assert_text`                 | 텍스트 존재 |
| `assertNoText(text)`           | `listTextNodes` + 검사            | 텍스트 부재 |
| `assertVisible(selector)`      | MCP `assert_visible`              | 요소 존재   |
| `assertNotVisible(selector)`   | `querySelectorAll` + 0개 확인     | 요소 부재   |
| `assertCount(selector, n)`     | `querySelectorAll` + length       | 요소 개수   |
| `assertValue(selector, value)` | `querySelector` + props.value     | Input 값    |
| `assertEnabled(selector)`      | `querySelector` + !props.disabled | 활성 상태   |
| `assertDisabled(selector)`     | `querySelector` + props.disabled  | 비활성 상태 |

---

### Phase D: 앱 생명주기 관리

**목표**: 테스트 간 앱 상태 격리.

**왜 필요한가**: AI는 현재 화면 상태를 보고 적응하지만, 자동화에서는 **매 테스트가 동일한 초기 상태**에서 시작해야 한다. 그렇지 않으면 이전 테스트의 상태가 다음 테스트에 영향을 준다.

**API**:

```typescript
// 앱 실행
await app.launch('com.example.myapp');
// Android: adb shell am start -n com.example.myapp/.MainActivity
// iOS: xcrun simctl launch booted com.example.myapp

// 앱 종료
await app.terminate('com.example.myapp');
// Android: adb shell am force-stop com.example.myapp
// iOS: xcrun simctl terminate booted com.example.myapp

// 앱 데이터 초기화 (AsyncStorage 등)
await app.clearData('com.example.myapp');
// Android: adb shell pm clear com.example.myapp
// iOS: xcrun simctl privacy booted reset all com.example.myapp

// 딥링크로 특정 화면 이동
await app.openDeepLink('myapp://screen/settings');
// Android: adb shell am start -a android.intent.action.VIEW -d "myapp://screen/settings"
// iOS: xcrun simctl openurl booted "myapp://screen/settings"

// 상태 리셋 (종료 → 데이터 초기화 → 재실행)
await app.resetApp('com.example.myapp');
```

**구현**: MCP 서버에 새 도구 추가 또는 SDK에서 직접 `child_process.exec` 호출.

---

### Phase E: YAML 테스트 러너 + CLI

**목표**: 코드 작성 없이 YAML로 E2E 테스트 정의 및 실행.

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

  - click:
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

| 액션                | 파라미터                       | 설명               |
| ------------------- | ------------------------------ | ------------------ |
| `click`             | `selector`, `label?`, `index?` | 요소 클릭          |
| `longPress`         | `selector`, `label?`           | 롱프레스           |
| `typeText`          | `selector`, `text`             | 텍스트 입력        |
| `scroll`            | `selector`, `x?`, `y`          | 스크롤             |
| `waitForText`       | `text`, `timeout?`             | 텍스트 대기        |
| `waitForVisible`    | `selector`, `timeout?`         | 요소 출현 대기     |
| `waitForNotVisible` | `selector`, `timeout?`         | 요소 사라짐 대기   |
| `assertText`        | `text`, `selector?`            | 텍스트 확인        |
| `assertVisible`     | `selector`                     | 요소 존재 확인     |
| `assertNotVisible`  | `selector`                     | 요소 부재 확인     |
| `assertCount`       | `selector`, `count`            | 요소 개수 확인     |
| `screenshot`        | `path?`                        | 스크린샷 저장      |
| `wait`              | `ms`                           | 고정 대기 (비추천) |
| `launch`            | `bundleId`                     | 앱 실행            |
| `terminate`         | `bundleId`                     | 앱 종료            |
| `openDeepLink`      | `url`                          | 딥링크 열기        |
| `evaluate`          | `script`                       | 임의 JS 실행       |

**CLI**:

```bash
# 단일 테스트 실행
npx react-native-mcp-test run tests/login.yaml

# 디렉토리 내 전체 실행
npx react-native-mcp-test run tests/

# 플랫폼 지정
npx react-native-mcp-test run tests/ --platform android

# 리포트 출력
npx react-native-mcp-test run tests/ --reporter junit --output results/
```

---

### Phase F: 테스트 리포트 & CI 통합

**목표**: CI 파이프라인에서 사용 가능한 결과 출력.

**리포터 종류**:

| 리포터           | 출력             | 용도                       |
| ---------------- | ---------------- | -------------------------- |
| `console` (기본) | 터미널 컬러 출력 | 로컬 개발                  |
| `junit`          | JUnit XML        | GitHub Actions, Jenkins 등 |
| `json`           | JSON 파일        | 커스텀 대시보드            |

**Console 리포터 출력 예시**:

```
✓ 로그인 플로우 (3.2s)
  ✓ typeText #email
  ✓ typeText #password
  ✓ click 로그인
  ✓ waitForText 환영합니다
  ✓ assertVisible #home-screen

✗ 회원가입 플로우 (5.1s)
  ✓ click 회원가입
  ✗ waitForText 가입 완료 (TimeoutError: 5000ms 초과)
    📸 Screenshot saved: results/회원가입-failure.png

Results: 1 passed, 1 failed (8.3s)
```

**실패 시 자동 동작**:

1. 스크린샷 자동 캡처 → `results/{테스트명}-failure.png`
2. Fiber 트리 스냅샷 저장 → `results/{테스트명}-snapshot.json`
3. 실패 스텝 및 에러 메시지 기록

**CI 설정 예시 (GitHub Actions)**:

```yaml
- name: Run E2E Tests
  run: npx react-native-mcp-test run tests/ --reporter junit --output results/

- name: Upload Results
  uses: actions/upload-artifact@v4
  if: always()
  with:
    name: e2e-results
    path: results/
```

---

## 3. 우선순위 및 의존 관계

```
Phase A: SDK ──────────┐
                       ├→ Phase B: Wait/Retry ──┐
                       ├→ Phase C: Assertions   ├→ Phase E: YAML 러너 → Phase F: CI 리포트
                       └→ Phase D: 앱 생명주기 ─┘
```

| Phase | 이름                    | 선행 조건 | 예상 규모                  |
| ----- | ----------------------- | --------- | -------------------------- |
| **A** | Programmatic Client SDK | 없음      | 새 패키지 1개, ~300줄      |
| **B** | Wait/Retry              | A         | SDK 메서드 추가, ~100줄    |
| **C** | 추가 Assertions         | A         | SDK 메서드 추가, ~150줄    |
| **D** | 앱 생명주기 관리        | A         | adb/simctl 래핑, ~200줄    |
| **E** | YAML 러너 + CLI         | A + B + C | YAML 파서 + 실행기, ~500줄 |
| **F** | CI 리포트               | E         | 리포터, ~300줄             |

**A~C만 완성하면** 프로그래밍 방식 E2E 테스트가 가능하다.
**E까지 완성하면** 비개발자도 YAML로 테스트를 작성할 수 있다.

---

## 4. 기존 E2E 도구와의 비교

| 항목                 | Detox         | Maestro        | Appium    | **MCP E2E**          |
| -------------------- | ------------- | -------------- | --------- | -------------------- |
| 네이티브 모듈 필요   | Yes           | No (별도 서버) | Yes       | **No**               |
| iOS/Android 통합 API | Yes           | Yes            | Yes       | **Yes** (Fiber)      |
| 셀렉터               | testID, label | label, id      | XPath, id | **Fiber 셀렉터**     |
| 설치 복잡도          | 높음          | 중간           | 높음      | **낮음** (Babel만)   |
| AI 에이전트 연동     | 없음          | 없음           | 없음      | **네이티브 지원**    |
| 네이티브 제스처      | 완전 지원     | 완전 지원      | 완전 지원 | **제한적** (섹션 12) |
| WebView 제어         | 제한적        | 제한적         | 지원      | **JS 실행 가능**     |
| 테스트 작성 방식     | JS/TS         | YAML           | 다양      | **JS/TS + YAML**     |

**MCP E2E의 차별점**: 동일한 도구를 AI 에이전트와 자동화 테스트가 공유한다. AI가 탐색적 테스트를 하고, 안정화된 시나리오를 YAML/스크립트로 전환하는 워크플로우가 가능하다.

---

## 5. 미결정 사항

| 항목                  | 선택지                                         | 결정 시점       |
| --------------------- | ---------------------------------------------- | --------------- |
| SDK 패키지 위치       | 모노레포 내 새 패키지 vs 서버 패키지 내 export | Phase A 시작 시 |
| YAML 스키마 표준      | 자체 정의 vs Maestro 호환                      | Phase E 시작 시 |
| 앱 생명주기 구현 위치 | MCP 도구로 추가 vs SDK에서 직접 exec           | Phase D 시작 시 |
| bun test 통합         | bun test matcher 제공 여부                     | Phase C 이후    |
| 병렬 테스트 실행      | 다중 디바이스 활용 병렬 실행 지원 여부         | Phase F 이후    |
