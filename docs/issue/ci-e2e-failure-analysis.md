# CI E2E 실패 원인 정리

gh run view 로그로 확인한 실제 실패 지점과, 코드 상에서의 원인을 정리한 문서.

## 1. iOS: tap "Count:" → Command timed out

### 현상

- **스위트**: 전체 35 스텝 (`all-steps.yaml`)
- **스텝**: `tap selector="Pressable:text(\"Count:\")"` (step 1)
- **에러**: `tap failed: Command timed out`
- **소요**: 약 33.9초 후 실패

### 코드상 원인

- `run-command.ts`: `timeoutMs` 경과 시 자식 프로세스를 `SIGKILL` 하고 `Error('Command timed out')` reject.
- `tap.ts`(iOS): `runIdbCommand(cmd, udid)` 호출. `idb-utils.ts`에서 **기본 `timeoutMs` 10초** 사용.
- 즉, **idb `ui tap` 명령이 10초 안에 끝나지 않아** 타임아웃 발생. 33.9초는 **스텝 전체 시간**(query_selector + tap 등)으로 보면, query_selector에서 앱 응답이 늦고 그 다음 idb tap에서 10초 타임아웃이 난 조합으로 해석 가능.

### 환경적 추정

- CI 시뮬레이터가 로컬보다 부하/지연이 커서:
  - 앱 ↔ MCP **query_selector** 응답이 느리거나,
  - **idb**가 시뮬레이터에 tap을 보냈는데 시뮬레이터가 반응하지 않아 10초 동안 대기 후 타임아웃.
- 시뮬레이터 지정이 "첫 번째 iPhone"이라 기기/해상도가 달라질 수 있음(이전에 iPhone 16 고정 제안한 이유).

---

## 2. Android: tap "다음" (Step 18→19) → has no measure data

### 현상

- **스위트**: 전체 35 스텝
- **스텝**: Step 18(Network Error) 다음 화면으로 가는 `tap selector="Pressable:text(\"다음\")"`
- **에러**: `tap: Element "Pressable:text("다음")" has no measure data`
- **소요**: 843ms 후 실패

### 코드상 원인

- **클라이언트** (`app-client.ts`): `tap(selector)` → `querySelector(selector)` → `el.measure`가 없으면 `McpToolError('tap', '... has no measure data')` throw.
- **앱 런타임** (`mcp-query.ts`): `querySelectorWithMeasure`에서 Fabric이면 동기 measure, Bridge면 `measureView(uid)` 비동기 보충. `measureView`가 실패하면 `.catch(() => return el)` 로 **measure 없이 el만 반환** → 클라이언트가 measure 없다고 판단.
- **measure 실패** (`mcp-measure.ts`): `measureView`는 native 노드를 찾아 `measureInWindow`(Fabric) 또는 `UIManager.measure`(Bridge) 호출. 노드를 못 찾거나 콜백이 오지 않으면 `reject(new Error('cannot measure: no native node'))` 등.

즉, **요소는 셀렉터로 찾았지만**, 그 시점에 **레이아웃/measure 정보를 가져오지 못한 경우**에 "has no measure data"가 난다.

### 환경적 추정

- Step 18(Network Error) 화면에서 "다음" 버튼을 탭하려는 순간:
  - 네트워크 에러 UI 갱신 직후 **리플로우/커밋이 끝나기 전**에 measure를 요청했거나,
  - 해당 노드가 **composite**인데 host child measure가 CI 환경에서만 실패하거나,
  - 에뮬레이터가 느려서 **measureInWindow / UIManager.measure 콜백이 늦게 오거나 오지 않음**.
- 로컬에서는 타이밍이 맞아서 measure가 채워지고, CI에서는 같은 스텝에서만 실패하는 **타이밍/레이아웃 불안정**으로 보는 것이 타당함.

---

## 3. 요약 표

| 플랫폼  | 실패 스텝               | 에러 메시지         | 직접 원인 (코드)                                                                               | 환경 추정                                          |
| ------- | ----------------------- | ------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| iOS     | tap "Count:" (step 1)   | Command timed out   | idb `ui tap` 10초 타임아웃 (`run-command.ts` + `idb-utils.ts`)                                 | 시뮬레이터/앱 지연, idb 무응답                     |
| Android | tap "다음" (Step 18→19) | has no measure data | query_selector는 성공, measure 보충 실패 → measure 없이 반환 (`mcp-query.ts`, `app-client.ts`) | 에러 화면 갱신 직후 measure 타이밍/레이아웃 불안정 |

---

## 4. 대응 방향 (참고)

- **iOS**
  - 시뮬레이터 기기 고정(예: iPhone 16)으로 환경 일관성 확보(이미 워크플로 수정 제안됨).
  - idb tap 타임아웃을 CI만 15~20초 등으로 늘리거나, tap 전에 짧은 대기(예: 500ms)를 넣어 시뮬레이터 안정화 후 탭하는 방법 검토.
- **Android**
  - "다음" 탭 직전에 **해당 요소가 보일 때까지 대기**(`waitForVisible` 등)를 넣거나, 실패 시 **한 번 재시도**(같은 스텝 재실행)로 measure 타이밍 이슈 완화.
  - Network Error 화면이 렌더/레이아웃 안정화되는 시간을 짧게 주는 것(예: `wait` 300~500ms)도 고려.

이 문서는 비주얼 리그레션/해상도가 아니라 **tap 타임아웃(iOS)** 과 **measure 미수집(Android)** 이 실제 원인임을 정리한 것이다.
