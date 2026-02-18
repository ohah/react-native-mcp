# E2E YAML 로드맵

Detox, Maestro와 비교하여 추가 예정인 스텝 및 기능 목록. 구현 순서와 난이도를 함께 정리한다.

> 현재 지원 스텝: [e2e-yaml-reference.md](e2e-yaml-reference.md)
> 도구 비교: [e2e-comparison.md](e2e-comparison.md)

---

## 구현 순서 총괄

새 스텝을 추가하는 패턴: `types.ts` → `parser.ts` → `runner.ts` → (필요 시) `app-client.ts` → (필요 시) 서버 `tools/*.ts`

| 순서 | 기능                   | 난이도 | 작업량 | 서버 도구 필요              | 비고                                                      |
| ---- | ---------------------- | ------ | ------ | --------------------------- | --------------------------------------------------------- |
| 1    | ~~`back`~~             | ★☆☆    | 0.5h   | ✗ (press_button 재사용)     | ✅ 구현 완료. pressButton BACK 래핑                       |
| 2    | ~~`home`~~             | ★☆☆    | 0.5h   | ✗ (press_button 재사용)     | ✅ 구현 완료. pressButton HOME 래핑                       |
| 3    | ~~`hideKeyboard`~~     | ★☆☆    | 0.5h   | ✗ (press_button / inputKey) | ✅ 구현 완료. iOS: inputKey(41) Escape, Android: BACK     |
| 4    | ~~`longPress`~~        | ★☆☆    | 0.5h   | ✗ (tap duration 재사용)     | ✅ 구현 완료. tap + duration 래핑 (기본 800ms)            |
| 5    | ~~`clearText`~~        | ★★☆    | 1h     | ✗ (typeText 빈 문자열)      | ✅ 구현 완료. typeText(selector, '') 래핑                 |
| 6    | ~~`doubleTap`~~        | ★★☆    | 1h     | ✗ (tap 2회)                 | ✅ 구현 완료. tap 2회 (기본 간격 50ms)                    |
| 7    | ~~`${VAR}` 환경 변수~~ | ★★☆    | 1.5h   | ✗                           | ✅ 구현 완료. parser에서 문자열 치환. CLI --env 옵션 추가 |
| 8    | ~~`addMedia`~~         | ★☆☆    | 0.5h   | ✗ (add_media 이미 존재)     | ✅ 구현 완료. 서버 도구 있음. runner 연결만               |
| 9    | ~~`assertHasText`~~    | ★☆☆    | 0.5h   | ✗ (assert_text 재사용)      | ✅ 구현 완료. assertText alias                            |
| 10   | ~~`assertValue`~~      | ★★☆    | 1h     | ✗ (querySelector value)     | ✅ 구현 완료. querySelector value prop 비교               |
| 11   | ~~`repeat`~~           | ★★☆    | 1.5h   | ✗                           | ✅ 구현 완료. runner에 재귀 루프. z.lazy() 재귀 정의      |
| 12   | ~~`runFlow`~~          | ★★☆    | 2h     | ✗                           | ✅ 구현 완료. 상대경로 해석 + Set 순환참조 방지           |
| 13   | ~~`if / when`~~        | ★★★    | 2h     | ✗                           | ✅ 구현 완료. platform/visible 조건. assertVisible 활용   |
| 14   | ~~`retry`~~            | ★★☆    | 1.5h   | ✗                           | ✅ 구현 완료. try-catch 루프. 중첩 스텝 실행              |
| 15   | `clearState`           | ★★☆    | 1h     | ✓ 새 도구                   | iOS: xcrun simctl, Android: adb pm clear                  |
| 16   | `setLocation`          | ★★☆    | 1.5h   | ✓ 새 도구                   | iOS: simctl location, Android: adb emu geo fix            |
| 17   | `copyText`             | ★★☆    | 1.5h   | △                           | querySelector로 텍스트 읽어서 내부 변수 저장              |
| 18   | `pasteText`            | ★★☆    | 1h     | △                           | 저장된 텍스트를 inputText로 입력                          |
| 19   | `pinch`                | ★★★    | 3h     | ✓ 새 도구                   | 멀티터치. idb 미지원 가능성, adb input 제한               |
| 20   | `waitForIdle`          | ★★★    | 4h+    | ✗ (runtime.js 수정)         | 애니메이션/네트워크 자동 대기. 아래 별도 섹션 참고        |

**예상 총 작업량**: ~24h (pinch, waitForIdle 제외 시 ~17h)

---

## Phase 1 — 기존 도구 래핑 (서버 변경 없음)

### 1. ~~back~~ ★☆☆ ✅ 구현 완료

기존 `press_button` BACK을 래핑하는 단축 스텝.

```yaml
- back:
```

---

### 2. ~~home~~ ★☆☆ ✅ 구현 완료

기존 `press_button` HOME 래핑.

```yaml
- home:
```

---

### 3. ~~hideKeyboard~~ ★☆☆ ✅ 구현 완료

iOS: `inputKey(41)` (HID Escape → 키보드 닫기). Android: BACK 키.

runner의 `StepContext`에 `platform` 추가하여 iOS/Android 분기 처리.

```yaml
- hideKeyboard:
```

---

### 4. ~~longPress~~ ★☆☆ ✅ 구현 완료

`tap` + `duration` 래핑. 기본 duration 800ms.

```yaml
- longPress:
    selector: '#item-3'
    duration: 1000
```

---

### 5. ~~clearText~~ ★★☆ ✅ 구현 완료

셀렉터로 TextInput을 찾아 텍스트를 전부 지운다. `typeText(selector, '')` 래핑.

```yaml
- clearText:
    selector: '#email'
```

---

### 6. ~~doubleTap~~ ★★☆ ✅ 구현 완료

같은 좌표를 빠르게 2회 탭. `querySelector` → 좌표 획득 → `tapXY` 2회 (기본 간격 50ms).

```yaml
- doubleTap:
    selector: '#zoomable-image'
    interval: 100 # 두 탭 사이 간격(ms), 기본 50
```

---

### 7. ~~addMedia~~ ★☆☆ ✅ 구현 완료

서버에 `add_media` 도구가 **이미 존재**. AppClient의 `addMedia(paths)` 메서드 연결.

```yaml
- addMedia:
    paths: ['/tmp/photo.jpg']
```

---

### 8. ~~assertHasText~~ ★☆☆ ✅ 구현 완료

기존 `assertText` alias. selector는 선택 필드.

```yaml
- assertHasText:
    text: '₩12,000'
    selector: '#price-label'
```

---

### 9. ~~assertValue~~ ★★☆ ✅ 구현 완료

TextInput 등의 `value` prop 검증. `querySelector` 결과의 `value` 필드를 `expected`와 비교.

```yaml
- assertValue:
    selector: '#quantity-input'
    expected: '3'
```

---

## Phase 2 — 파서/러너 확장 (흐름 제어)

### 10. ~~`${VAR}` 환경 변수~~ ★★☆ ✅ 구현 완료

**구현 범위**: parser.ts + cli.ts (2파일)

**구현 전략**: YAML 파싱 후, 전체 객체를 재귀 순회하며 문자열 내 `${VAR}` 패턴을 `process.env.VAR`로 치환.

```typescript
// parser.ts
function interpolateVars(obj: unknown, vars: Record<string, string>): unknown {
  if (typeof obj === 'string') {
    return obj.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] ?? '');
  }
  if (Array.isArray(obj)) return obj.map((item) => interpolateVars(item, vars));
  if (obj && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, interpolateVars(v, vars)]));
  }
  return obj;
}

// parseFile에서 suiteSchema.parse 전에:
const vars = { ...process.env, ...cliEnvVars };
const interpolated = interpolateVars(raw, vars);
const result = suiteSchema.parse(interpolated);
```

```yaml
- typeText: { selector: '#email', text: '${TEST_EMAIL}' }
```

---

### 11. ~~repeat~~ ★★☆ ✅ 구현 완료

**구현 범위**: types.ts + parser.ts + runner.ts (3파일)

**핵심 이슈**: stepSchema가 자체를 참조하는 재귀 구조. Zod `z.lazy()` 사용.

```typescript
// parser.ts
const stepSchema: z.ZodType<unknown> = z.lazy(() => z.union([
  // ... 기존 스텝들 ...
  z.object({
    repeat: z.object({
      times: z.number(),
      steps: z.array(stepSchema).min(1),
    }),
  }),
]));

// runner.ts
else if ('repeat' in step) {
  for (let i = 0; i < step.repeat.times; i++) {
    for (const s of step.repeat.steps) {
      await executeStep(app, s, ctx);
    }
  }
}
```

```yaml
- repeat:
    times: 5
    steps:
      - swipe: { selector: '#list', direction: up }
      - wait: 300
```

---

### 12. ~~runFlow~~ ★★☆ ✅ 구현 완료

**구현 범위**: parser.ts + runner.ts + types.ts (3파일)

**핵심 이슈**: 상대 경로 해석 (현재 YAML 파일 기준), 순환참조 방지.

```typescript
// types.ts
| { runFlow: string }

// runner.ts
else if ('runFlow' in step) {
  const flowPath = resolve(dirname(currentYamlPath), step.runFlow);
  const flowSuite = parseFile(flowPath);
  // 현재 runner의 steps만 실행 (config/setup/teardown 무시)
  for (const s of flowSuite.steps) {
    await executeStep(app, s, ctx);
  }
}
```

**순환참조 방지**: `Set<string>`으로 이미 include한 파일 경로 추적.

```yaml
- runFlow: ./shared/login.yaml
```

---

### 13. ~~if / when~~ ★★★ ✅ 구현 완료

**구현 범위**: types.ts + parser.ts + runner.ts (3파일)

**핵심 이슈**: 조건 평가. `platform`은 단순 비교, `visible`은 assertVisible 비동기 호출 필요.

```typescript
// runner.ts
else if ('if' in step) {
  let shouldRun = true;

  if (step.if.platform) {
    shouldRun = step.if.platform === app.platform;
  }

  if (step.if.visible && shouldRun) {
    const result = await app.assertVisible(step.if.visible);
    shouldRun = result.pass;
  }

  if (shouldRun) {
    for (const s of step.if.steps) {
      await executeStep(app, s, ctx);
    }
  }
}
```

**난이도가 높은 이유**: 조건 타입 확장성 (text, notVisible, env 등), 재귀 스텝 구조, 테스트 케이스 다양.

```yaml
- if:
    platform: android
    steps:
      - back
```

---

### 14. ~~retry~~ ★★☆ ✅ 구현 완료

**구현 범위**: types.ts + parser.ts + runner.ts (3파일)

```typescript
// runner.ts
else if ('retry' in step) {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= step.retry.times; attempt++) {
    try {
      for (const s of step.retry.steps) {
        await executeStep(app, s, ctx);
      }
      lastError = undefined;
      break; // 성공
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < step.retry.times) {
        await new Promise(r => setTimeout(r, 500)); // 재시도 전 대기
      }
    }
  }
  if (lastError) throw lastError;
}
```

```yaml
- retry:
    times: 3
    steps:
      - tap: { selector: '#flaky-button' }
      - waitForVisible: { selector: '#result', timeout: 2000 }
```

---

## Phase 3 — 새 서버 도구 필요

### 15. clearState ★★☆ ✅ 구현 완료

**구현 범위**: 서버 `tools/clear-state.ts` 신규 + tools/index.ts + app-client.ts + types/parser/runner

```typescript
// tools/clear-state.ts
// iOS: xcrun simctl privacy <udid> reset all <bundleId>
//      또는 앱 삭제 후 재설치
// Android: adb shell pm clear <packageName>
```

**플랫폼 차이**: iOS는 `simctl privacy reset all`로 **권한/프라이버시만** 리셋(앱 샌드박스 미삭제). Android는 `pm clear`로 **전체 앱 데이터** 삭제. 문서에 명시됨.

```yaml
- clearState: com.example.app
```

---

### 16. setLocation ★★☆ ✅ 구현 완료

**구현 범위**: 서버 `tools/set-location.ts` 신규 + tools/index.ts + app-client.ts + types/parser/runner

```typescript
// tools/set-location.ts
// iOS: xcrun simctl location <udid> set <lat> <lon>
// Android: adb emu geo fix <lon> <lat> (에뮬레이터만)
//          또는 adb shell am start-service로 mock location provider
```

**플랫폼 차이**: iOS 시뮬 모두 지원(idb set-location). Android는 **에뮬레이터 전용**; 실기기 미지원. 문서에 명시됨.

```yaml
- setLocation:
    latitude: 37.5665
    longitude: 126.978
```

---

### 17-18. copyText / pasteText ★★☆ ✅ 구현 완료

**구현 범위**: app-client.ts에 내부 클립보드 변수 + types/parser/runner

**구현 전략**: `copyText`는 querySelector로 텍스트를 읽어서 AppClient 내부 변수에 저장. `pasteText`는 저장된 값을 `inputText`로 입력. 실제 OS 클립보드는 사용하지 않음 (보안 제한).

```typescript
// app-client.ts
private clipboard: string = '';

async copyText(selector: string): Promise<void> {
  const el = await this.querySelector(selector);
  this.clipboard = el.text ?? '';
}

async pasteText(): Promise<void> {
  await this.inputText(this.clipboard);
}
```

```yaml
- copyText: { selector: '#invite-code' }
- tap: { selector: '#code-input' }
- pasteText
```

---

### 19. pinch ★★★

**구현 범위**: 서버 `tools/pinch.ts` 신규 + app-client.ts + types/parser/runner

**핵심 어려움**:

- **멀티터치 제스처**로 단일 `input` 명령으로 불가
- **iOS**: idb에 pinch 직접 지원 없음. XCUITest (WebDriverAgent) 또는 `simctl io` 필요
- **Android**: `adb input` 멀티터치 미지원. `input motionevent` 조합 또는 Appium/UIAutomator 연동 필요

**대안**: evaluate로 앱 내부에서 `PanResponder` / `Gesture` 이벤트를 프로그래밍적으로 트리거. 제한적이지만 가능.

```yaml
- pinch:
    selector: '#map-view'
    scale: 2.0
```

---

## Phase 4 — 자동 동기화 (waitForIdle)

### 20. waitForIdle ★★★ (실험적)

Detox의 핵심 기능인 **자동 동기화**를 runtime.js 기반으로 구현.

#### Detox는 어떻게 하는가

Detox는 앱 내부에 네이티브 모듈(EarlGrey/Espresso)을 심어서 다음을 모니터링한다:

1. **메인 스레드 유휴**: UI 렌더링 큐에 펜딩 작업 없음
2. **JS 스레드 유휴**: React Native JS 스레드에 펜딩 마이크로태스크 없음
3. **네트워크 유휴**: 진행 중인 fetch/XHR 없음 (NSURLSession/OkHttp 인터셉트)
4. **애니메이션 유휴**: 실행 중인 Animated/LayoutAnimation 없음
5. **타이머 유휴**: 펜딩 setTimeout/setInterval 없음 (임계값 이상)
6. **RN 브릿지 유휴**: 브릿지 메시지 큐 비어있음

모든 액션 전에 위 조건이 **전부 충족**될 때까지 대기. 이 덕분에 `wait()`가 거의 필요 없다.

#### 우리가 구현할 수 있는 범위

runtime.js에 유휴 감지 함수를 추가. 네이티브 스레드 접근은 불가하므로 **JS 레벨 유휴**만 감지:

```javascript
// runtime.js에 추가
__REACT_NATIVE_MCP__.isIdle = function () {
  var idle = true;
  var reasons = [];

  // 1. Animated 실행 중 확인
  try {
    var Animated = require('react-native').Animated;
    // Animated._active 또는 NativeAnimatedHelper 통해 실행 중 애니메이션 수 확인
    // (React Native 내부 API — 버전별 차이 있음)
  } catch (e) {}

  // 2. 펜딩 네트워크 요청 확인 (이미 networkRequests로 인터셉트 중)
  var pendingRequests = __REACT_NATIVE_MCP__._pendingXHR || 0;
  if (pendingRequests > 0) {
    idle = false;
    reasons.push('network: ' + pendingRequests + ' pending');
  }

  // 3. 펜딩 fetch 확인
  var pendingFetch = __REACT_NATIVE_MCP__._pendingFetch || 0;
  if (pendingFetch > 0) {
    idle = false;
    reasons.push('fetch: ' + pendingFetch + ' pending');
  }

  return { idle: idle, reasons: reasons };
};
```

#### YAML 스텝

```yaml
# 명시적 사용
- waitForIdle:
    timeout: 5000

# 또는 config 레벨로 모든 액션 전 자동 대기
config:
  autoWaitForIdle: true  # 모든 tap/swipe/assert 전에 idle 대기
```

#### 구현 난이도가 높은 이유

- React Native 내부 API (`Animated._active` 등) 가 **버전마다 다름**
- Hermes vs JSC 런타임 차이
- setTimeout 인터셉트는 앱 동작에 영향을 줄 수 있음
- LayoutAnimation 감지는 네이티브 레벨 없이 어려움
- 네트워크 인터셉트는 이미 runtime.js에 XHR/fetch 훅이 있어서 상대적으로 쉬움

#### 현실적 1차 목표

완전한 Detox 수준은 어렵지만, **네트워크 유휴 + Animated 완료** 감지만으로도 대부분의 `wait()` 제거 가능:

```
Phase 4a: 네트워크 유휴 감지 (XHR/fetch 펜딩 카운터) — ★★☆ 1.5h
Phase 4b: Animated 실행 중 감지 — ★★★ 3h (RN 버전 호환성 테스트 필요)
Phase 4c: 전체 autoWait 통합 — ★★☆ 1h
```

---

## 구현 로드맵 타임라인

```
Phase 1 (기존 도구 래핑) ─── 예상 6h
 ├─ #1 back              ★☆☆  0.5h  ✅ 완료
 ├─ #2 home              ★☆☆  0.5h  ✅ 완료
 ├─ #3 hideKeyboard      ★☆☆  0.5h  ✅ 완료
 ├─ #4 longPress         ★☆☆  0.5h  ✅ 완료
 ├─ #5 clearText         ★★☆  1h    ✅ 완료
 ├─ #6 doubleTap         ★★☆  1h    ✅ 완료
 ├─ #7 addMedia          ★☆☆  0.5h  ✅ 완료
 ├─ #8 assertHasText     ★☆☆  0.5h  ✅ 완료
 └─ #9 assertValue       ★★☆  1h    ✅ 완료

Phase 2 (흐름 제어) ─────── 예상 8h
 ├─ #10 ${VAR}           ★★☆  1.5h  ✅ 완료
 ├─ #11 repeat           ★★☆  1.5h  ✅ 완료
 ├─ #12 runFlow          ★★☆  2h    ✅ 완료
 ├─ #13 if/when          ★★★  2h    ✅ 완료
 └─ #14 retry            ★★☆  1.5h  ✅ 완료

Phase 3 (새 서버 도구) ──── 예상 7h
 ├─ #15 clearState       ★★☆  1h
 ├─ #16 setLocation      ★★☆  1.5h
 ├─ #17-18 copy/paste    ★★☆  2.5h
 └─ #19 pinch            ★★★  3h   (멀티터치 한계로 보류 가능)

Phase 4 (자동 동기화) ───── 예상 5.5h
 ├─ #20a 네트워크 idle    ★★☆  1.5h
 ├─ #20b Animated idle   ★★★  3h
 └─ #20c autoWait 통합   ★★☆  1h
```

---

## 셀렉터 참고: displayName은 타입 셀렉터로 바로 사용 가능

React Native 컴포넌트의 `displayName` (또는 함수 이름)은 웹의 DOM element name과 동일하게 동작한다. 별도 문법 없이 **컴포넌트 이름을 그대로 셀렉터로 사용**할 수 있다.

```yaml
# CustomerCard 컴포넌트를 직접 셀렉터로 사용
- tap: { selector: 'CustomerCard' }
- tap: { selector: 'CustomerCard:text("홍길동")' }
- tap: { selector: 'CustomerCard#customer-1' }

# 기존 :display-name 의사 셀렉터도 동일하게 동작
- tap: { selector: ':display-name("CustomerCard")' }
```

`getFiberTypeName()`이 `displayName > name > "Component"` 순으로 이름을 결정하므로, 커스텀 컴포넌트의 함수 이름이나 `displayName`이 곧 셀렉터가 된다.

---

## 현재 지원 vs 추가 예정 요약

| 카테고리          | 현재 지원                                                                                    | 추가 예정                 |
| ----------------- | -------------------------------------------------------------------------------------------- | ------------------------- |
| **탭/제스처**     | tap, swipe, scrollUntilVisible, **longPress**, **doubleTap**                                 | pinch                     |
| **텍스트**        | typeText, inputText, **clearText**                                                           | copyText, pasteText       |
| **대기**          | wait, waitForText, waitForVisible, waitForNotVisible                                         | waitForIdle (자동 동기화) |
| **검증**          | assertText, assertVisible, assertNotVisible, assertCount, **assertHasText**, **assertValue** | —                         |
| **비주얼 비교**   | **compareScreenshot** (전체 화면 + 컴포넌트 크롭, pixelmatch)                                | —                         |
| **흐름 제어**     | **runFlow**, **repeat**, **if/when**, **${VAR}**, **retry**                                  | —                         |
| **네트워크 모킹** | **mockNetwork**, **clearNetworkMocks**                                                       | —                         |
| **디바이스**      | pressButton, **back**, **home**, **hideKeyboard**                                            | setLocation, clearState   |
| **앱 제어**       | launch, terminate, openDeepLink, **addMedia**                                                | —                         |
| **기타**          | screenshot, evaluate, webviewEval                                                            | —                         |
