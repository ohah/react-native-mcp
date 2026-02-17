# @ohah/react-native-mcp-client

React Native MCP 도구를 프로그래밍 방식으로 호출하는 타입 안전 SDK.

## 설치

모노레포 내부에서는 별도 설치 불필요 (`workspace:*`로 자동 연결).

```bash
bun add @ohah/react-native-mcp-client
```

## 빠른 시작

```typescript
import { createApp } from '@ohah/react-native-mcp-client';

const app = await createApp({ platform: 'ios' });

await app.tap('#login-btn');
await app.typeText('#email', 'user@test.com');
await app.waitForText('환영합니다', { timeout: 5000 });

await app.close();
```

## 연결

`createApp()`은 MCP 서버를 자동 spawn하고 앱 WebSocket 연결을 대기한다.

```typescript
const app = await createApp({
  platform: 'ios', // 'ios' | 'android' (필수)
  deviceId: 'ios-1', // 다중 디바이스 시 지정 (선택)
  serverCommand: 'bun', // MCP 서버 실행 명령 (기본: 'bun')
  serverArgs: ['dist/index.js'], // MCP 서버 인자 (기본값)
  serverCwd: '/path/to/server', // 서버 CWD (기본: 자동 감지)
  connectionTimeout: 90_000, // 앱 연결 대기 ms (기본: 90초)
  connectionInterval: 2_000, // 폴링 간격 ms (기본: 2초)
  iosOrientation: 3, // iOS GraphicsOrientation 강제값 (1-4, 선택). 생략 시 자동 감지.
});
```

`platform`은 생성 시 설정되며 모든 호출에 기본 적용된다. 호출별로 override 가능:

```typescript
await app.tap('#btn', { platform: 'android' });
```

## API

### 편의 메서드

일반적인 E2E 시나리오에서 가장 많이 쓰는 메서드.

#### `tap(selector, opts?)`

selector로 요소를 찾아 중앙을 탭. 내부적으로 `querySelector` → 좌표 계산 → `tap`.

```typescript
await app.tap('#submit-btn');
await app.tap('Pressable:text("로그인")');
await app.tap('#btn', { duration: 1000 }); // 롱프레스
```

#### `swipe(selector, opts)`

selector로 요소를 찾아 방향으로 스와이프.

```typescript
await app.swipe('#list', { direction: 'up' });
await app.swipe('#carousel', { direction: 'left', distance: 200 });
await app.swipe('#carousel', { direction: 'left', distance: '80%' }); // 요소 너비의 80%
```

#### `typeText(selectorOrUid, text, opts?)`

TextInput에 텍스트 입력. selector(`#`, `:`, `[` 등 포함)면 자동으로 querySelector 후 uid 추출.

```typescript
await app.typeText('#email', 'user@test.com'); // selector
await app.typeText('0.1.3', 'hello'); // uid 직접 전달
```

#### `waitForText(text, opts?)`

텍스트가 화면에 나타날 때까지 폴링. MCP 서버 측에서 폴링하므로 라운드트립 1회.

```typescript
await app.waitForText('환영합니다', { timeout: 5000 });
await app.waitForText('결과', { selector: '#result-area', timeout: 3000 });
```

#### `waitForVisible(selector, opts?)` / `waitForNotVisible(selector, opts?)`

요소 출현/사라짐 대기.

```typescript
await app.waitForVisible('#home-screen', { timeout: 5000 });
await app.waitForNotVisible('#loading-spinner', { timeout: 10000 });
```

### 조회

```typescript
const tree = await app.snapshot(); // Fiber 트리 전체
const tree = await app.snapshot({ maxDepth: 5 }); // 깊이 제한

const el = await app.querySelector('#login-btn'); // 단일 요소 (없으면 null)
const els = await app.querySelectorAll(':has-press'); // 복수 요소

const content = await app.screenshot(); // 스크린샷 (raw MCP content)
const ui = await app.describeUi(); // 네이티브 UI 트리
```

`querySelector` 반환값:

```typescript
{
  uid: '0.1.2.3',
  type: 'Pressable',
  testID: 'login-btn',
  text: '로그인',
  measure: { x: 0, y: 0, width: 100, height: 44, pageX: 20, pageY: 200 },
  value: 'input text',     // TextInput인 경우
  disabled: false,          // 비활성 상태인 경우
  editable: true,           // TextInput 편집 가능 여부
}
```

### Assertion

결과는 `{ pass: boolean, message: string }` — 테스트 러너의 expect와 조합해서 사용.

```typescript
const r1 = await app.assertText('Welcome');
expect(r1.pass).toBe(true);

const r2 = await app.assertVisible('#home');
const r3 = await app.assertNotVisible('#login-modal');

// 요소 개수
const r4 = await app.assertElementCount('.card', { expectedCount: 3 });
const r5 = await app.assertElementCount('.item', { minCount: 1, maxCount: 10 });
console.log(r5.actualCount); // number
```

폴링 지원 (CI 안정성):

```typescript
const r = await app.assertText('Loaded', { timeoutMs: 5000, intervalMs: 300 });
```

#### 추가 Assertion

```typescript
// 텍스트가 화면에 없는지 확인
const r6 = await app.assertNoText('에러 발생');

// 요소 개수 (간편 버전)
const r7 = await app.assertCount('.card', 3);

// TextInput 값 확인
const r8 = await app.assertValue('#email', 'user@test.com');

// 활성/비활성 상태 확인
const r9 = await app.assertEnabled('#submit-btn');
const r10 = await app.assertDisabled('#loading-btn');
```

#### `waitFor(predicate, opts?)`

커스텀 조건이 충족될 때까지 폴링. 조건 미충족 시 `McpToolError` throw.

```typescript
await app.waitFor(
  async () => {
    const el = await app.querySelector('#counter');
    return el?.text === '10';
  },
  { timeout: 5000, interval: 500 }
);
```

### 좌표 기반 인터랙션 (raw)

좌표를 직접 알고 있을 때 사용.

```typescript
await app.tapXY(150, 300);
await app.tapXY(150, 300, { duration: 1000 }); // 롱프레스
await app.swipeXY(150, 400, 150, 200, { duration: 500 });
```

### 텍스트 입력 / 키 입력

```typescript
await app.inputText('hello'); // 현재 포커스된 입력에 ASCII 텍스트
await app.inputKey(66); // keycode 전송
await app.pressButton('BACK'); // 물리 버튼
await app.pressButton('HOME');
```

### 스크롤

```typescript
// 요소가 보일 때까지 자동 스크롤
const result = await app.scrollUntilVisible('#item-50', {
  direction: 'down',
  maxScrolls: 20,
  scrollableSelector: '#my-list',
});
console.log(result.pass, result.scrollCount);
```

### 코드 실행

```typescript
// 앱 컨텍스트에서 JS 실행
const result = await app.evaluate('() => Date.now()');

// WebView 내부 JS 실행
const title = await app.webviewEval('main-webview', 'document.title');
```

### 딥링크

```typescript
await app.openDeepLink('myapp://screen/settings');
await app.openDeepLink('https://example.com/product/123');
```

### 디버깅

```typescript
const logs = await app.consoleLogs({ level: 'error', limit: 10 });
await app.clearConsoleLogs();

const requests = await app.networkRequests({ url: '/api', method: 'POST' });
await app.clearNetworkRequests();

const status = await app.getStatus();
// { appConnected: true, devices: [{ deviceId: 'ios-1', platform: 'ios' }] }
```

### 디바이스 / 파일

```typescript
const devices = await app.listDevices();
await app.filePush('/local/file.json', '/data/file.json', { bundleId: 'com.example.app' });
await app.addMedia(['/path/to/photo.jpg']);
await app.switchKeyboard('switch', { keyboard_id: 'com.google.android.inputmethod.korean' });
```

### 앱 생명주기

```typescript
// 앱 실행
await app.launch('com.example.myapp');

// 앱 종료
await app.terminate('com.example.myapp');

// 앱 재시작 (종료 → 실행)
await app.resetApp('com.example.myapp');
```

### 정리

```typescript
await app.close(); // MCP 서버 프로세스 종료
```

## bun test와 함께 사용

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { createApp, type AppClient } from '@ohah/react-native-mcp-client';

describe('로그인 플로우', () => {
  let app: AppClient;

  beforeAll(async () => {
    app = await createApp({ platform: 'android' });
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  it('이메일/비밀번호 입력 후 로그인', async () => {
    await app.typeText('#email', 'user@test.com');
    await app.typeText('#password', 'secret123');
    await app.tap('Pressable:text("로그인")');

    const result = await app.waitForText('환영합니다', { timeout: 5000 });
    expect(result.pass).toBe(true);
  });

  it('홈 화면 표시 확인', async () => {
    const r = await app.assertVisible('#home-screen');
    expect(r.pass).toBe(true);
  });
});
```

## 에러 처리

```typescript
import { McpToolError, ConnectionError } from '@ohah/react-native-mcp-client';

try {
  await app.tap('#nonexistent');
} catch (e) {
  if (e instanceof McpToolError) {
    console.log(e.toolName); // 'tap'
    console.log(e.message); // 'tap: No element found for selector: #nonexistent'
  }
}
```

## 타입

```typescript
import type {
  CreateAppOptions,
  Platform, // 'ios' | 'android'
  DeviceOpts, // { deviceId?, platform? }
  AssertOpts, // DeviceOpts + { timeoutMs?, intervalMs? }
  AssertResult, // { pass, message }
  AssertCountResult, // AssertResult + { actualCount }
  ElementInfo, // { uid, type, testID?, text?, measure? }
  ElementMeasure, // { x, y, width, height, pageX, pageY }
  ScrollUntilVisibleResult,
  DebuggerStatus,
  WaitOpts, // DeviceOpts + { timeout?, interval? }
} from '@ohah/react-native-mcp-client';
```
