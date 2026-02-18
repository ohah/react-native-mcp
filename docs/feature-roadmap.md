# react-native-mcp 기능 로드맵

경쟁력 강화를 위한 전체 기능 로드맵. E2E YAML 스텝 추가는 [e2e-yaml-roadmap.md](e2e-yaml-roadmap.md), 도구 비교는 [e2e-comparison.md](e2e-comparison.md) 참고.

---

## 포지셔닝 전략

"더 나은 E2E 테스트 도구"가 아니라 **"다른 카테고리의 도구"**로 포지셔닝한다.

```
Detox  = E2E 테스트 프레임워크 (자동 동기화)
Maestro = 노코드 모바일 테스트 (YAML)
Appium  = 범용 모바일 자동화 (WebDriver)

react-native-mcp = React 런타임 연결 MCP 도구 (AI 연동 + 인스펙션 + E2E)
```

E2E 기능을 Detox/Maestro 수준으로 맞추는 것보다, **fiber 접근 + MCP로만 가능한 것**을 먼저 구현하는 게 차별화에 유리하다.

---

## 즉시 — 안정화 (이거 없으면 신규 채택 불가)

### 1. New Architecture 지원 — 이미 동작 중 ✓

**현황**: demo app(RN 0.83.1)이 이미 New Architecture(Fabric) 활성 상태에서 동작 확인됨.

- iOS: `RCTNewArchEnabled = true` (Info.plist)
- Android: `fabricEnabled` 사용 중 (MainActivity.kt)
- Podfile.lock: React-Fabric pod 전부 설치

**왜 그냥 되는가**:

- fiber의 핵심 필드(type, memoizedProps, child, sibling, return)는 Old/New 아키텍처 **모두 동일**
- `__REACT_DEVTOOLS_GLOBAL_HOOK__`은 아키텍처 무관하게 React 코어에서 호출
- rendererID = 1이 Fabric에서도 그대로 유지됨

**추가로 확인하면 좋은 것**:

| 항목                     | 설명                                                      |
| ------------------------ | --------------------------------------------------------- |
| 복수 rendererID 탐색     | 향후 멀티 렌더러 시나리오 대비 `hook.renderers` 전체 순회 |
| Old Architecture 앱 호환 | RN 0.74 이하 Old Architecture에서도 여전히 정상 동작 확인 |

**난이도**: ★☆☆ — 이미 동작 중. 방어적 코드 추가만 필요.

---

### 2. Expo 검증 및 가이드

**현황**: Expo 관련 코드/문서 없음. 하지만 기술적으로는 이미 동작할 가능성 높음.

**왜 동작하는가**:

- runtime.js는 순수 JS — Expo도 동일한 Hermes 런타임 사용
- `__REACT_DEVTOOLS_GLOBAL_HOOK__`은 React 표준 — Expo에서도 동일
- WebSocket은 RN 내장 — Expo에서도 동일
- `require('react-native')`는 Expo에서도 동일

**해야 할 것**:

| 항목                          | 설명                                                   |
| ----------------------------- | ------------------------------------------------------ |
| Expo Dev Client에서 동작 검증 | `npx expo start --dev-client` 환경에서 MCP 연결 테스트 |
| Expo Go 확인                  | 샌드박스 환경에서 localhost WebSocket 연결 가능 여부   |
| Expo Router 가이드            | `app/_layout.tsx`에서 `__DEV__` import 예시            |
| `npx expo install` 호환 확인  | 패키지 설치 흐름 검증                                  |

**난이도**: ★☆☆ — 코드 변경 없이 문서 + 검증 위주.

**예상 결과**:

```
Expo Dev Client: ✓ (동작)
Expo Go: △ (localhost 연결 제한 가능, 확인 필요)
```

---

### 3. 연결 안정성 (Heartbeat) — 구현 완료 ✓

**구현 내용**:

- **클라이언트 (runtime.js)**: 30초 간격으로 앱→서버 `ping` 전송. `pong` 미수신 시 10초 타임아웃 후 연결 종료 → 기존 재연결 로직으로 재접속. 앱이 백그라운드로 가면 heartbeat 중단, 포그라운드 복귀 시 재개 (AppState 연동).
- **서버 (websocket-server.ts)**: `ping` 수신 시 `pong` 응답. 60초 이상 메시지 없는 연결은 15초 주기로 검사해 stale로 판단 후 `close()` 호출 (기존 `close` 핸들러가 디바이스 정리).

**사용법**: 별도 설정 없이 동작한다. 앱과 서버가 연결된 상태에서 자동으로 ping/pong이 오가며, 끊긴 연결은 클라이언트가 재연결하고 서버는 오래된 연결을 정리한다.

**난이도**: ★★☆ (완료)

---

## 단기 — 고유 강점 강화 (fiber + MCP로만 가능한 것)

### 4. React 상태/Hook 인스펙션

**왜 중요**: Detox/Maestro/Appium은 **UI에 보이는 것만** 테스트. 우리는 보이지 않는 React 상태도 검증 가능.

#### memoizedState 체인 구조

React의 **모든 Hook**은 fiber의 `memoizedState` 링크드 리스트에 저장된다. `useState`뿐 아니라 외부 상태 관리 라이브러리도 내부적으로 Hook을 쓰므로 전부 읽을 수 있다.

```
fiber.memoizedState → hook[0] → hook[0].next → hook[1] → hook[1].next → ...
```

**라이브러리별 내부 Hook 매핑**:

| 라이브러리                  | 내부 Hook                  | memoizedState에 보이는 값         |
| --------------------------- | -------------------------- | --------------------------------- |
| `useState`                  | 직접                       | state 값 그대로                   |
| `useReducer`                | 직접                       | reducer state 그대로              |
| **Zustand**                 | `useSyncExternalStore`     | selector로 선택한 스냅샷          |
| **Redux** (react-redux v8+) | `useSyncExternalStore`     | `useSelector` 반환값              |
| **React Query** (TanStack)  | `useSyncExternalStore`     | `{ data, isLoading, error, ... }` |
| **Jotai**                   | `useReducer` + `useEffect` | atom 값                           |
| **Recoil**                  | 내부 Hook 조합             | selector/atom 값                  |

> `useSyncExternalStore`도 Hook이므로 체인에 스냅샷이 저장된다. 현대 상태 관리 라이브러리 대부분이 이걸 사용한다.

#### 실제 fiber 예시

```javascript
// 컴포넌트 코드
function CartScreen() {
  const [count, setCount] = useState(0); // hook[0]
  const items = useCartStore((s) => s.items); // hook[1] — Zustand
  const { data } = useQuery({ queryKey: ['cart'] }); // hook[2] — React Query
  const total = useSelector((s) => s.cart.total); // hook[3] — Redux
}

// fiber.memoizedState 체인:
// hook[0].memoizedState = 0                                        ← useState
// hook[1].memoizedState = [{ id: 1, name: '사과' }]               ← Zustand 스냅샷
// hook[2].memoizedState = { status: 'success', data: {...}, ... }  ← React Query
// hook[3].memoizedState = 12000                                    ← Redux selector
```

#### 구현: Hook 파싱 (runtime.js)

```javascript
function parseHooks(fiber) {
  var hooks = [];
  var hook = fiber.memoizedState;
  var i = 0;
  while (hook) {
    var type = 'unknown';
    if (hook.queue) {
      // useState / useReducer / useSyncExternalStore — 상태를 가진 Hook
      type = 'state';
    } else if (hook.create) {
      // useEffect / useLayoutEffect
      type = 'effect';
    } else if (Array.isArray(hook.memoizedState)) {
      // useMemo / useCallback — [value, deps] 형태
      type = 'memo';
    }
    if (type === 'state') {
      hooks.push({ index: i, type: type, value: hook.memoizedState });
    }
    hook = hook.next;
    i++;
  }
  return hooks;
}
```

> effect/memo는 디버깅용이므로, `inspect_state`는 `type === 'state'`인 Hook만 반환하여 노이즈를 줄인다.

#### MCP tool 설계

```
MCP tool: inspect_state
├─ 입력: { selector: string }
├─ 출력: {
│    component: 'CartScreen',
│    hooks: [
│      { index: 0, type: 'state', value: 0 },
│      { index: 1, type: 'state', value: [{ id: 1, name: '사과' }] },
│      { index: 2, type: 'state', value: { status: 'success', data: {...} } },
│      { index: 3, type: 'state', value: 12000 },
│    ]
│  }
└─ 활용: AI가 컴포넌트 상태를 보고 디버깅 / 테스트 검증
```

#### YAML 스텝

```yaml
# Hook index 기반 — 정확하지만 순서 의존
- assertState:
    selector: 'CartScreen'
    hookIndex: 0
    value: 3

# path 기반 — 첫 번째 state Hook의 nested 값 접근
- assertState:
    selector: 'CartProvider'
    path: 'items.length'
    value: 3

# Zustand/Redux 등 외부 store — evaluate로 직접 접근 (이미 가능)
- evaluate:
    script: 'JSON.stringify(useCartStore.getState())'
```

#### 두 가지 접근법 비교

| 접근 방식                    | 장점                                              | 단점                                      | 용도                |
| ---------------------------- | ------------------------------------------------- | ----------------------------------------- | ------------------- |
| `memoizedState` 파싱         | store를 global에 노출할 필요 없음, 모든 Hook 접근 | Hook 순서 기반이라 리팩토링 시 index 변경 | 디버깅, AI 인스펙션 |
| `evaluate`로 store 직접 접근 | 정확하고 구조 명확                                | `__DEV__`에서 global 노출 필요            | E2E 검증 (안정적)   |

> 둘 다 지원하는 게 이상적. `inspect_state`는 디버깅/AI용, `evaluate`는 E2E 검증용.

#### 경쟁 도구 비교

| 기능                      | react-native-mcp         | Detox | Maestro | Appium |
| ------------------------- | ------------------------ | ----- | ------- | ------ |
| React useState 조회       | ✓                        | ✗     | ✗       | ✗      |
| Zustand/Redux 스냅샷 조회 | ✓ (useSyncExternalStore) | ✗     | ✗       | ✗      |
| React Query 상태 조회     | ✓ (useSyncExternalStore) | ✗     | ✗       | ✗      |
| Hook 값 전체 인스펙션     | ✓ (memoizedState 체인)   | ✗     | ✗       | ✗      |
| 상태 기반 assertion       | ✓ (assertState)          | ✗     | ✗       | ✗      |

**난이도**: ★★☆ — memoizedState 링크드 리스트 순회는 단순. Hook 타입 추론(`queue`/`create` 존재 여부)도 안정적. RN 버전 무관하게 구조 동일.

#### 상태 변경 로깅 (State Change Log)

**현재 이미 있는 로깅**:

| 기능               | 구현 상태 | 버퍼  | API                                                         |
| ------------------ | --------- | ----- | ----------------------------------------------------------- |
| 콘솔 로그 캡처     | ✓ 완료    | 500개 | `getConsoleLogs({ level, since, limit })`                   |
| 네트워크 요청 캡처 | ✓ 완료    | 200개 | `getNetworkRequests({ url, method, status, since, limit })` |

**추가할 로깅 — 상태 변경 이력**:

`onCommitFiberRoot` 훅이 이미 걸려 있으므로, 커밋마다 **변경된 fiber를 diff**해서 버퍼에 push하면 된다.

```javascript
// runtime.js — onCommitFiberRoot 확장
var _stateChanges = [];
var _STATE_CHANGE_BUFFER = 300;
var _prevFiberSnapshots = new Map(); // component key → previous hook values

onCommitFiberRoot: function (rendererID, root) {
  // 기존: root 저장
  if (!_roots.has(rendererID)) _roots.set(rendererID, new Set());
  _roots.get(rendererID).add(root);

  // 추가: 변경된 fiber 탐색
  var current = root.current;            // 현재 fiber 트리
  var alternate = current.alternate;      // 이전 fiber 트리
  if (!alternate) return;                 // 최초 마운트 — diff 없음

  // alternate(이전)와 current(현재)에서 memoizedState가 다른 fiber 수집
  diffFiberTree(alternate, current);
}

function diffFiberTree(prev, next) {
  if (!next) return;
  if (next.tag === 0 || next.tag === 1) { // FunctionComponent / ClassComponent
    var name = getFiberTypeName(next);
    var prevHooks = extractStateHooks(prev);
    var nextHooks = extractStateHooks(next);
    for (var i = 0; i < nextHooks.length; i++) {
      if (i < prevHooks.length && !shallowEqual(prevHooks[i], nextHooks[i])) {
        _stateChanges.push({
          id: ++_stateChangeId,
          timestamp: Date.now(),
          component: name,
          hookIndex: i,
          prev: prevHooks[i],
          next: nextHooks[i],
        });
        if (_stateChanges.length > _STATE_CHANGE_BUFFER) _stateChanges.shift();
      }
    }
  }
  diffFiberTree(prev.child, next.child);
  diffFiberTree(prev.sibling, next.sibling);
}
```

**MCP tool**:

```
MCP tool: get_state_changes
├─ 입력: { component?: string, since?: number, limit?: number }
├─ 출력: [
│    { timestamp, component: 'CartScreen', hookIndex: 0, prev: 0, next: 1 },
│    { timestamp, component: 'CartScreen', hookIndex: 1,
│      prev: [{ id: 1 }], next: [{ id: 1 }, { id: 2 }] },    ← Zustand 스냅샷 변경
│  ]
└─ 활용: AI가 상태 변경 흐름을 추적하여 버그 원인 분석
```

**YAML 스텝 예시**:

```yaml
# 특정 조작 전후의 상태 변경 확인
- tap: { selector: '#add-to-cart' }
- wait: 500
- assertStateChanged:
    component: 'CartScreen'
    hookIndex: 1 # Zustand store 스냅샷
    path: 'length'
    expected: 2 # 아이템이 1개 → 2개로 변경됐는지 검증
```

**기존 로깅과의 관계**:

```
콘솔 로그      ← nativeLoggingHook 체이닝 (이미 구현)
네트워크 로그  ← XHR/fetch monkey-patch (이미 구현)
상태 변경 로그 ← onCommitFiberRoot diff (추가 예정) ← 인프라 이미 있음
리렌더 로그    ← onCommitFiberRoot count (섹션 7 참고)
```

> 콘솔·네트워크·상태변경·리렌더 4가지 로그를 통합 조회하는 `get_timeline` 도구도 가능. 타임스탬프 기준 merge하면 "이 탭 → 이 API 호출 → 이 상태 변경 → 이 리렌더" 흐름을 AI가 자동 분석할 수 있다.

**난이도**: ★★☆ (완료) — `onCommitFiberRoot` + `alternate` diff 패턴은 React DevTools Profiler와 동일한 방식. 버퍼 관리는 콘솔/네트워크와 같은 패턴 재사용.

#### 구현 완료 요약

**MCP 도구 3개 추가**:

| 도구                  | 설명                                          | 파일                   |
| --------------------- | --------------------------------------------- | ---------------------- |
| `inspect_state`       | 셀렉터로 찾은 컴포넌트의 state Hook 목록 반환 | `inspect-state.ts`     |
| `get_state_changes`   | 상태 변경 이력 조회 (component/since/limit)   | `get-state-changes.ts` |
| `clear_state_changes` | 상태 변경 버퍼 초기화                         | `get-state-changes.ts` |

**runtime.js 변경**:

- `_stateChanges` 순환 버퍼 (300개)
- `parseHooks(fiber)` — memoizedState 체인에서 state Hook 추출
- `shallowEqual(a, b)` — 배열/객체 얕은 비교
- `safeClone(val)` — 순환 참조 방지 + depth 4 제한
- `collectStateChanges(fiber)` — fiber.alternate 비교로 변경된 Hook 수집
- `onCommitFiberRoot` 래핑 — 커밋마다 자동 수집 (DevTools 유무 무관)
- MCP 객체에 `inspectState`, `getStateChanges`, `clearStateChanges` 메서드 추가

**테스트**: `inspect-state.test.ts` — 35개 테스트 (런타임 함수 + 도구 핸들러)

---

### 5. 네트워크 모킹 — 구현 완료 ✓

**왜 중요**: runtime.js에 이미 XHR/fetch 인터셉트 코드가 있음. 응답 모킹까지 확장하면 다른 도구에 없는 기능.

**구현 방식**: XHR.send/fetch 호출 시 URL 패턴 매칭 → 실제 요청을 보내지 않고 가짜 응답 반환 (MSW/nock과 동일).

**MCP 도구 4개**:

| 도구                  | 설명                                                                                      |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `set_network_mock`    | 모킹 룰 추가. urlPattern(필수), isRegex, method, status, statusText, headers, body, delay |
| `list_network_mocks`  | 현재 등록된 룰 목록 + hitCount 조회                                                       |
| `remove_network_mock` | 특정 룰 제거 (id)                                                                         |
| `clear_network_mocks` | 모든 룰 초기화                                                                            |

**런타임 구현**:

- `src/runtime/network-mock.ts` — 룰 저장/매칭/CRUD. `findMatchingMock(method, url)` → 첫 매칭 반환, hitCount++
- `src/runtime/xhr-patch.ts` — `XHR.send()` 전에 mock 체크. 매칭 시 RN XMLHttpRequest 내부 메서드(`__didCreateRequest` → `__didReceiveResponse` → `__didReceiveData` → `__didCompleteResponse`)로 응답 주입. `_origSend` 호출하지 않음
- `src/runtime/fetch-patch.ts` — `fetch()` 전에 mock 체크. 매칭 시 `new Response(body, {status, headers})` 반환. Response 없는 환경은 fallback 객체 사용

**XHR mock 기술 노트** (RN 환경 특수성):

Hermes에는 global `Event` 생성자가 없고, RN의 `dispatchEvent`는 Event 인스턴스만 허용한다. 따라서 `xhr.dispatchEvent(new Event('load'))` 또는 `xhr.dispatchEvent({type:'load'})` 모두 실패한다. 대신 RN XMLHttpRequest의 내부 메서드를 직접 호출하여 내부 이벤트 파이프라인을 타게 함으로써 `addEventListener('load', ...)` 콜백이 정상 트리거된다.

> **버전 호환성**: `__did*` 내부 메서드는 RN 0.72~0.83에서 안정적으로 동작 확인됨. RN 0.84에서 `XHRInterceptor` API는 deprecated 되었으나, XMLHttpRequest 클래스 자체와 `__did*` 메서드는 변경/제거되지 않았다. 장기적으로 RN이 네트워크 스택을 재구성할 경우 대응이 필요할 수 있다.

**YAML 스텝**:

```yaml
- mockNetwork:
    urlPattern: 'jsonplaceholder.typicode.com/posts/1'
    method: GET
    status: 200
    body: '{"id":1,"title":"Mocked Post"}'
    headers:
      Content-Type: application/json

- tap: { selector: '#fetch-btn' }
- waitForText: { text: 'Mocked Post', timeout: 5000 }
- clearNetworkMocks:
```

**경쟁 도구 비교**:

| 기능                 | react-native-mcp | Detox           | Maestro | Appium |
| -------------------- | ---------------- | --------------- | ------- | ------ |
| 네트워크 인터셉트    | ✓ (JS 레벨)      | URL blacklist만 | ✗       | ✗      |
| 응답 모킹            | ✓                | ✗               | ✗       | ✗      |
| 요청 지연 시뮬레이션 | ✓ (delay)        | ✗               | ✗       | ✗      |

**난이도**: ★★☆ (완료) — 인터셉트 인프라 이미 있었음. 룰 매칭 + 응답 주입 로직 추가.

---

### 6. 자동 접근성(a11y) 감사

**왜 중요**: 접근성 규정 강화 추세 (미국 ADA, EU EAA). fiber 트리로 자동 감지 가능.

**구현 방식**: fiber 트리 순회 → 접근성 규칙 위반 검출.

```
MCP tool: accessibility_audit
├─ 출력: [
│    { rule: 'pressable-needs-label', selector: 'Pressable', severity: 'error',
│      message: 'Pressable에 accessibilityLabel 또는 accessible text가 없습니다' },
│    { rule: 'touch-target-size', selector: '#small-btn', severity: 'warning',
│      message: '터치 영역이 44x44pt 미만입니다 (32x28pt)' },
│  ]
└─ 검사 항목: 아래 참고
```

**검사 항목**:

| 규칙                  | 설명                                     | fiber에서 감지 가능한 이유                                   |
| --------------------- | ---------------------------------------- | ------------------------------------------------------------ |
| pressable-needs-label | onPress 있는데 accessibilityLabel 없음   | `memoizedProps.onPress` + `memoizedProps.accessibilityLabel` |
| image-needs-alt       | Image에 alt/accessibilityLabel 없음      | `fiber.type === Image` + props 확인                          |
| touch-target-size     | 터치 영역 44x44pt 미만                   | `measure()` 좌표로 크기 계산                                 |
| missing-role          | 인터랙티브 요소에 accessibilityRole 없음 | `memoizedProps.accessibilityRole`                            |
| text-contrast         | 텍스트/배경 색상 대비 부족               | `memoizedProps.style.color` + 부모 backgroundColor           |

**경쟁 도구 비교**: **어떤 모바일 E2E 도구도 이 기능이 없다.** 웹에서는 axe-core, Lighthouse가 하는 역할.

**난이도**: ★★☆ — fiber 순회 + 규칙 체크. 기본 규칙 5~10개로 시작.

---

### 7. 리렌더 추적 / 성능 프로파일링

**왜 중요**: React DevTools Profiler는 GUI 전용. AI가 자동으로 성능 분석해주는 도구는 없음.

**구현 방식**: `onCommitFiberRoot` 훅이 이미 있으므로, 커밋마다 변경된 fiber를 추적.

```
MCP tool: get_render_report
├─ 출력: {
│    totalCommits: 47,
│    duration: '5.2s',
│    hotComponents: [
│      { name: 'ProductList', renders: 23, avgDuration: '12ms', unnecessaryRenders: 15 },
│      { name: 'CartBadge', renders: 18, avgDuration: '2ms', unnecessaryRenders: 16 },
│    ],
│    recommendation: 'ProductList: React.memo 적용 권장. CartBadge: selector 최적화 권장.'
│  }
└─ 동작: 프로파일 시작 → 사용자 조작 → 프로파일 종료 → 리포트
```

**YAML 스텝 예시**:

```yaml
- startProfile
- tap: { selector: '#products-tab' }
- swipe: { selector: '#product-list', direction: up }
- swipe: { selector: '#product-list', direction: up }
- endProfile:
    path: ./results/performance-report.json
```

**경쟁 도구 비교**: **완전히 새로운 카테고리.** Detox/Maestro/Appium 어디에도 없음.

**난이도**: ★★★ — onCommitFiberRoot 활용은 쉬우나, "불필요한 리렌더" 판정 로직과 정확한 duration 측정이 까다로움.

---

### 8. 비주얼 리그레션 테스트

**왜 중요**: 스크린샷은 이미 있으니, 컴포넌트 단위 캡처 + 이미지 비교만 추가하면 됨.

**구현 방식**: querySelector로 좌표 획득 → 해당 영역만 크롭 → 베이스라인과 비교.

```yaml
- screenshot:
    selector: '#product-card' # 특정 컴포넌트만 캡처
    compare: ./baseline/card.png # 베이스라인과 비교
    threshold: 0.01 # 1% 이상 차이면 실패
```

**경쟁 도구 비교**:

| 기능               | react-native-mcp | Detox    | Maestro | Appium   |
| ------------------ | ---------------- | -------- | ------- | -------- |
| 전체 스크린샷      | ✓                | ✓        | ✓       | ✓        |
| 컴포넌트 단위 캡처 | ✓ (fiber 좌표)   | ✗        | ✗       | ✗        |
| 이미지 비교        | 예정             | 플러그인 | ✗       | 플러그인 |

**난이도**: ★★☆ — 이미지 크롭은 간단. 비교 알고리즘은 pixelmatch 등 기존 라이브러리 활용.

---

## 중기 — 생태계 확장

### 9. CI/CD 통합

**현황**: CI 관련 문서/템플릿 없음.

**GitHub Actions 워크플로우 예시**:

```yaml
# .github/workflows/e2e-ios.yml
name: E2E (iOS)
on: [push, pull_request]

jobs:
  e2e:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4

      - name: Install dependencies
        run: bun install

      - name: Install Pods
        run: cd ios && pod install

      - name: Build iOS app
        run: xcodebuild -workspace ios/MyApp.xcworkspace -scheme MyApp -sdk iphonesimulator -configuration Debug -derivedDataPath build

      - name: Boot simulator
        run: |
          xcrun simctl boot "iPhone 16"
          xcrun simctl install booted build/Build/Products/Debug-iphonesimulator/MyApp.app

      - name: Run E2E tests
        run: npx react-native-mcp-test run e2e/ -p ios -r junit -o e2e-artifacts

      - name: Upload results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-results
          path: e2e-artifacts/
```

**지원해야 할 CI 환경**:

| CI 서비스      | 난이도 | 비고                          |
| -------------- | ------ | ----------------------------- |
| GitHub Actions | ★☆☆    | macOS runner 기본 제공        |
| Bitrise        | ★☆☆    | 모바일 특화, 시뮬레이터 내장  |
| CircleCI       | ★★☆    | macOS executor 유료           |
| GitLab CI      | ★★☆    | macOS runner 자체 호스팅 필요 |
| Jenkins        | ★★☆    | 자체 구성                     |

**CI 최적화 옵션**:

```bash
# 실패해도 나머지 스위트 실행 (CI에서 유용)
npx react-native-mcp-test run e2e/ --no-bail

# JUnit 리포트 (CI 대시보드 연동)
npx react-native-mcp-test run e2e/ -r junit -o artifacts

# 앱 자동 실행 안 함 (CI에서 미리 설치한 경우)
npx react-native-mcp-test run e2e/ --no-auto-launch
```

**난이도**: ★★☆ — 템플릿 작성 + 실제 CI에서 검증.

---

### 10. 병렬 테스트

**현재**: 스위트를 순차 실행. 하나의 디바이스에서 하나의 스위트.

**목표**:

```bash
# 멀티 스위트 병렬 실행
npx react-native-mcp-test run e2e/ -p ios --parallel 3

# 멀티 디바이스 병렬 (iOS 시뮬레이터 여러 대)
npx react-native-mcp-test run e2e/ -p ios --devices "iPhone 16,iPhone SE"
```

**구현 방식**:

```
Sequential (현재):
  Suite A → Suite B → Suite C  (총 시간: A + B + C)

Parallel (목표):
  Device 1: Suite A ─────┐
  Device 2: Suite B ─────┤  (총 시간: max(A, B, C))
  Device 3: Suite C ─────┘
```

**핵심 구현 사항**:

| 항목        | 설명                                                           |
| ----------- | -------------------------------------------------------------- |
| 워커 풀     | Node.js worker_threads 또는 child_process로 스위트별 독립 실행 |
| 디바이스 풀 | 사용 가능한 시뮬레이터/에뮬레이터를 풀로 관리, 스위트에 배분   |
| 포트 관리   | 워커마다 다른 WebSocket 포트 사용 (12300, 12301, 12302...)     |
| 결과 병합   | 워커별 결과를 하나의 RunResult로 합침                          |
| 리포팅      | 병렬 진행 상황 표시 (워커별 상태)                              |

**난이도**: ★★★ — 포트 관리, 디바이스 풀링, 결과 병합 복잡.

---

### 11. 리포팅 개선

**현재**: console, json, junit, **html**, **slack**, **github-pr** 6가지 리포터. (HTML/Slack/GitHub PR 구현 완료 ✓)

**추가할 리포터**:

| 리포터                | 설명                                           | 난이도 | 상태   |
| --------------------- | ---------------------------------------------- | ------ | ------ |
| **HTML**              | 스크린샷 포함 시각적 리포트. 브라우저에서 열기 | ★★☆    | ✓ 완료 |
| **Slack/Discord**     | 웹훅으로 결과 요약 전송. 실패 시 스크린샷 경로 | ★★☆    | ✓ 완료 |
| **GitHub PR Comment** | `gh` CLI로 PR에 결과 코멘트 자동 작성          | ★☆☆    | ✓ 완료 |
| **Dashboard**         | 시간별 추이, flaky 테스트 감지, 통계           | ★★★    | 미구현 |

**HTML 리포트 예시**:

```
┌─────────────────────────────────────────────────┐
│ E2E Test Report                    2025-01-15   │
├─────────────────────────────────────────────────┤
│ ✓ 로그인 플로우          3 steps   1.2s passed  │
│ ✗ 장바구니 플로우        5 steps   3.4s failed  │
│   Step 3: assertText "₩12,000"                  │
│   Expected: "₩12,000"  Actual: "₩0"             │
│   [📸 실패 스크린샷]                             │
│ ○ 결제 플로우            - skipped               │
├─────────────────────────────────────────────────┤
│ Total: 2 suites, 8 steps, 1 failed (4.6s)      │
└─────────────────────────────────────────────────┘
```

**Slack 웹훅 예시**:

```bash
npx react-native-mcp-test run e2e/ -p ios -r slack --slack-webhook $SLACK_WEBHOOK
```

**난이도**: HTML ★★☆, Slack ★★☆, GitHub PR ★☆☆, Dashboard ★★★

**Dashboard 미포함 이유**: 시간별 추이·flaky 감지·통계는 실행 이력 저장, 시계열 데이터, flaky 판정 로직, 전용 UI/서비스가 필요해 범위가 크고(★★★) 별도 이슈/PR로 진행하는 것이 적절함.

---

---

## 🗄️ 먼 미래 백로그

> 아래 항목은 현재 우선순위 밖. 핵심 기능이 안정화된 이후 필요에 따라 검토.

### ~~에러 복구 전략~~

~~앱 크래시 자동 재시작, 연결 끊김 재시도, 스위트 레벨 retry, quarantine(격리). 현재는 스텝 실패 → 스크린샷 → skip으로 충분.~~

### ~~플러그인/확장 시스템~~

~~사용자 커스텀 스텝 등록(`definePlugin`), 동적 스키마 병합, 실행 위임. 내장 스텝이 충분히 성숙한 이후에 고려.~~

---

### 12. VS Code / Cursor 확장

```
현재: CLI + MCP tool로만 사용
추가:
├─ 사이드 패널에 컴포넌트 트리 시각화
├─ 트리에서 컴포넌트 클릭 → 소스 코드로 이동
├─ 인라인 접근성 경고 표시
└─ 네트워크 요청 실시간 뷰
```

**난이도**: ★★★

---

### 13. 원커맨드 셋업 (CLI init)

```bash
npx react-native-mcp init

# 자동으로:
# 1. 패키지 설치
# 2. App.tsx에 __DEV__ import 추가
# 3. MCP 클라이언트 설정 파일 생성 (.cursor/mcp.json 등)
# 4. .gitignore에 결과 디렉토리 추가
```

**Expo 지원**:

```bash
npx react-native-mcp init --expo

# 자동으로:
# 1. npx expo install로 패키지 설치
# 2. app/_layout.tsx에 __DEV__ import 추가
# 3. MCP 설정 파일 생성
```

**난이도**: ★★☆

---

### 14. 문서 및 온보딩

| 항목          | 현재       | 목표                                    |
| ------------- | ---------- | --------------------------------------- |
| 퀵스타트      | 없음       | 5분 가이드 (bare RN + Expo)             |
| API 레퍼런스  | 내부 docs/ | 외부 공개 문서 사이트                   |
| 비디오 데모   | 없음       | "AI가 앱을 조작하는 모습" 30초 GIF/영상 |
| CI/CD 가이드  | 없음       | GitHub Actions 템플릿                   |
| 예제 프로젝트 | demo-app   | + Expo 예제, + 실전 시나리오            |

**난이도**: ★★☆ (시간은 걸리지만 기술적 난이도는 낮음)

---

## 우선순위 총괄

### 시기별 정리

```
즉시 (안정화) ───────────────────────────────────────────────
 ├─ 1. Expo 검증 + 가이드          ★☆☆  — 코드 변경 없이 문서/검증
 ├─ ✓ 연결 heartbeat (구현 완료)   ★★☆  — 안정성
 └─ ✓  New Architecture            ★☆☆  — 이미 동작 중 (RN 0.83.1 Fabric 확인)

단기 (고유 강점) ────────────────────────────────────────────
 ├─ 3. E2E YAML Phase 1            ★☆☆~★★☆ — 기본 스텝 9개 (별도 로드맵)
 ├─ 4. React 상태 인스펙션         ★★☆  — fiber만 가능
 ├─ ✓ 네트워크 모킹 (구현 완료)    ★★☆  — XHR/fetch 인터셉트 + 응답 주입
 ├─ 6. 접근성 자동 감사            ★★☆  — 규제 트렌드 + fiber 강점
 ├─ 7. E2E YAML Phase 2            ★★☆~★★★ — 흐름 제어 5개
 └─ 8. 비주얼 리그레션             ★★☆  — 스크린샷 이미 있음

중기 (생태계) ───────────────────────────────────────────────
 ├─ 9.  CI/CD 통합                 ★★☆  — GitHub Actions 등 템플릿 + 검증
 ├─ 10. 병렬 테스트                ★★★  — 멀티 디바이스/스위트 동시 실행
 ├─ 11. 리포팅 개선                ★★☆~★★★ — HTML/Slack/GitHub PR ✓, Dashboard 별도
 ├─ 12. VS Code 확장               ★★★  — DX
 ├─ 13. 원커맨드 셋업              ★★☆  — 온보딩
 └─ 14. 문서 + 예제                ★★☆  — 채택률

장기 (E2E YAML 고급 + 프로파일링) ──────────────────────────
 ├─ E2E YAML Phase 3-4             ★★☆~★★★ — 서버 도구 + 자동 동기화
 └─ 리렌더 프로파일링              ★★★  — 새로운 카테고리

백로그 (먼 미래) ────────────────────────────────────────────
 ├─ ~~에러 복구 전략~~             ★★☆  — 현재 스텝 skip 방식으로 충분
 └─ ~~플러그인/확장 시스템~~       ★★★  — 내장 스텝 성숙 후 고려
```

### 난이도별 정리

#### ★☆☆ 쉬움 (0.5~1h, 기존 인프라 재사용)

| 기능                 | 구현 범위                        | 비고                                    |
| -------------------- | -------------------------------- | --------------------------------------- |
| Expo 검증 + 가이드   | 문서 + 테스트                    | 코드 변경 없음. 이미 동작할 가능성 높음 |
| E2E: `back`          | types + parser + runner          | pressButton BACK 래핑                   |
| E2E: `home`          | types + parser + runner          | pressButton HOME 래핑                   |
| E2E: `hideKeyboard`  | types + parser + runner          | iOS: Keyboard.dismiss(), Android: BACK  |
| E2E: `longPress`     | types + parser + runner          | tap + duration 래핑                     |
| E2E: `addMedia`      | types + parser + runner + client | 서버 도구 이미 존재                     |
| E2E: `assertHasText` | types + parser + runner          | 기존 assertText 재사용                  |

#### ★★☆ 보통 (1~2h, 새 로직 필요하지만 패턴 있음)

| 기능                       | 구현 범위                        | 비고                              |
| -------------------------- | -------------------------------- | --------------------------------- |
| 연결 heartbeat (구현 완료) | runtime.js + websocket-server.ts | ping/pong + stale 정리            |
| E2E: `clearText`           | types + parser + runner + client | evaluate 활용                     |
| E2E: `doubleTap`           | types + parser + runner + client | tap 2회, 서버 딜레이 조정 필요    |
| E2E: `${VAR}` 환경 변수    | parser.ts + cli.ts               | 재귀 문자열 치환                  |
| E2E: `assertValue`         | types + parser + runner + client | querySelector value prop          |
| E2E: `repeat`              | types + parser + runner          | z.lazy() 재귀 + 루프              |
| E2E: `runFlow`             | parser + runner + types          | YAML include + 순환참조 방지      |
| E2E: `retry`               | types + parser + runner          | try-catch 루프                    |
| E2E: `clearState`          | 서버 도구 신규 + 전체            | iOS simctl / Android pm clear     |
| E2E: `setLocation`         | 서버 도구 신규 + 전체            | simctl location / adb emu geo fix |
| E2E: `copyText/pasteText`  | client + types + parser + runner | 내부 클립보드 변수                |
| React 상태 인스펙션        | runtime.js + 서버 도구           | memoizedState 순회                |
| ✓ 네트워크 모킹 (완료)     | runtime.js + 서버 도구           | 기존 인터셉터에 룰 매칭 추가      |
| 접근성 자동 감사           | runtime.js + 서버 도구           | fiber 순회 + 규칙 체크            |
| 비주얼 리그레션            | 서버 도구 + runner               | 이미지 크롭 + pixelmatch          |
| 원커맨드 셋업              | 새 CLI 패키지                    | AST 파싱으로 import 삽입          |
| 문서 + 예제                | docs/ + examples/                | 기술 난이도 낮음, 시간 소요       |
| waitForIdle (네트워크)     | runtime.js                       | XHR/fetch 펜딩 카운터             |

#### ★★★ 어려움 (2h+, 새 아키텍처 또는 외부 의존성)

| 기능                   | 구현 범위               | 비고                        |
| ---------------------- | ----------------------- | --------------------------- |
| E2E: `if/when`         | types + parser + runner | 조건 타입 확장성, 재귀 스텝 |
| E2E: `pinch`           | 서버 도구 신규 + 전체   | 멀티터치 — idb/adb 제한     |
| waitForIdle (Animated) | runtime.js              | RN 내부 API 버전 호환성     |
| 리렌더 프로파일링      | runtime.js + 서버 도구  | 불필요 리렌더 판정 로직     |
| VS Code 확장           | 새 패키지               | VS Code API + 트리 시각화   |

### 추천 구현 순서 (빠른 성과 → 깊은 차별화)

```
Week 1: E2E Phase 1 쉬운 것 (back, home, hideKeyboard, longPress, addMedia, assertHasText)
         + Expo 검증/가이드
         → 6개 스텝 추가 + Expo 공식 지원 선언

Week 2: E2E Phase 1 나머지 (clearText, doubleTap, assertValue)
         + ✓ 연결 heartbeat (완료)
         → 기본기 완성 + 안정성 향상

Week 3: 환경 변수 (${VAR}) + repeat + runFlow
         → YAML 시나리오 재사용 가능 (Maestro 수준)

Week 4: React 상태 인스펙션 + 네트워크 모킹
         → "다른 도구가 절대 못 하는" 고유 기능 2개 확보

Week 5: 접근성 자동 감사 + if/when + retry
         → 규제 대응 기능 + 흐름 제어 완성

Week 6: 비주얼 리그레션 + 원커맨드 셋업
         → 실용 기능 + 온보딩 개선

Week 7: CI/CD 통합 (GitHub Actions 템플릿)
         + 리포팅 개선 (HTML, Slack, GitHub PR Comment) ✓ 완료
         → CI 파이프라인 즉시 사용 가능

Week 8: 병렬 테스트
         → 대규모 테스트 스위트 지원 (Slack 리포터 ✓ 완료)
```

---

## "다른 도구가 절대 못 하는 것" 요약

fiber 접근 + MCP 조합으로만 가능한 고유 기능:

| 기능                          | Detox | Maestro | Appium | react-native-mcp               |
| ----------------------------- | ----- | ------- | ------ | ------------------------------ |
| 컴포넌트 이름으로 셀렉팅      | ✗     | ✗       | ✗      | ✓ `CustomerCard`               |
| React 상태/Hook 인스펙션      | ✗     | ✗       | ✗      | ✓ `memoizedState`              |
| 리렌더 추적 + 성능 분석       | ✗     | ✗       | ✗      | ✓ `onCommitFiberRoot`          |
| 접근성 자동 감사 (props 기반) | ✗     | ✗       | ✗      | ✓ fiber props 직접 검사        |
| 네트워크 응답 모킹            | ✗     | ✗       | ✗      | ✓ JS 인터셉터 확장 (구현 완료) |
| 컴포넌트 단위 스크린샷        | ✗     | ✗       | ✗      | ✓ fiber measure                |
| AI 자율 디버깅                | ✗     | ✗       | ✗      | ✓ MCP 프로토콜                 |
| WebView 내부 JS 실행          | ✗     | ✗       | △      | ✓ `webviewEval`                |

이 기능들이 구현되면 "E2E 테스트 도구"가 아니라 **"React Native 개발 필수 도구"**로 포지셔닝할 수 있다.
