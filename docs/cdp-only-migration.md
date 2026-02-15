# CDP 전용 전환 시 변경 사항 (12300 제거)

## 1. 바꿀 것 요약

| 위치                          | 변경 내용                                                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **metro-cdp.ts**              | `Runtime.evaluate` 요청/응답 대기 API 추가 (`evaluateInApp(code)`)                                                               |
| **tools/\* (eval 쓰는 도구)** | `appSession.sendRequest({ method: 'eval', ... })` → CDP `evaluateInApp(code)` 로 교체, 연결 체크는 `cdpClient.isConnected()`     |
| **index.ts**                  | `appSession.start(12300)` 제거 또는 옵션화, 도구 등록 시 appSession 대신 “eval 제공자”만 전달                                    |
| **runtime.js**                | 12300 WebSocket 클라이언트 제거. `__REACT_NATIVE_MCP__` / Fiber 훅 등은 유지 (번들에 포함되어 있어야 CDP로 실행하는 코드가 동작) |
| **websocket-server.ts**       | CDP 전용 모드에서는 사용 안 함 (또는 옵션으로 비활성화)                                                                          |

---

## 2. 상세 변경

### 2.1 metro-cdp.ts

- **지금**: `send(method, params)`만 있고, 응답을 기다리지 않음. 수신은 이벤트만 push.
- **추가**:
  - 메시지 수신 시 `id`가 있으면 “요청에 대한 응답”으로 처리하고, 해당 id의 Promise resolve.
  - `Runtime.evaluate`를 보내고 `id`로 응답을 기다리는 **`evaluateInApp(code: string): Promise<{ result?: unknown; exceptionDetails?: unknown }>`** 공개 API 추가.
- **연결**: 앱에서 init 안 보내도 되므로, MCP 쪽에서 `getMetroBaseUrl()`(env 또는 기본 8230)로 **서버 기동 시 또는 첫 도구 호출 시** `cdpClient.connect(metroBaseUrl)` 호출.

### 2.2 도구 (eval 사용처)

- **eval-code, click, click-by-label, take-snapshot, list-clickables, list-text-nodes, get-by-label, webview_evaluate_script** 등에서:
  - `appSession.isConnected()` → `cdpClient.isConnected()` 또는 `getDebuggerStatus().connected` 사용.
  - `appSession.sendRequest({ method: 'eval', params: { code } })` → `evaluateInApp(code)` 호출로 교체.
    반환 형태를 기존 `{ result?, error? }`에 맞게 변환하면 나머지 도구 로직은 그대로 둬도 됨.

### 2.3 index.ts / 진입점

- CDP 전용 모드에서는 `appSession.start(WS_PORT)` 호출하지 않음.
- `registerAllTools(server, appSession)` 대신 “eval 제공자”만 넘기거나, 내부에서 `evaluateInApp` + `isConnected`를 쓰도록 해서 appSession 의존 제거.

### 2.4 runtime.js (앱 번들)

- **12300 WebSocket 연결 코드 전부 제거** (connect, onmessage, send 등).
- **유지**: `__REACT_NATIVE_MCP__` 등록, `triggerPress`, 스냅샷/라벨용 코드, `connectToServer` 등 CDP로 호출될 코드.
  → 이 코드는 그대로 번들에 들어가 있어야 하고, CDP `Runtime.evaluate`로 실행되는 문자열이 이 전역/함수를 참조함.

---

## 3. 디버거(개발툴) 꼭 켜야 하나?

**아니요. 꼭 켤 필요 없습니다.**

- Metro에 붙은 앱이 있으면 **Inspector Proxy가 이미 CDP 타겟을 등록**해서 `/json`에 노출합니다.
- MCP는 그 타겟의 `webSocketDebuggerUrl`로 연결해 `Runtime.evaluate`만 쓰면 됩니다.
- 따라서 **“디버거 UI(Chrome/스탠드얼론)를 켜라”는 요구는 없습니다.**
  `react-native start` + 앱 실행만 하면 CDP 타겟이 생깁니다.

**주의할 점:**

- 일부 환경(Hermes/구성에 따라)에서는 **CDP 연결이 한 번에 하나만** 허용될 수 있습니다.
- 그럴 경우 **디버거 UI를 켜면 MCP CDP 연결이 끊기거나, MCP가 연결하면 디버거 UI가 안 붙을 수** 있음.
  “디버거를 켜야만 동작한다”가 아니라 “동시에 둘 다 붙이면 충돌할 수 있다”에 가깝습니다.

---

## 4. 정리

- **구조상 바꿀 것**: metro-cdp에 `evaluateInApp` 추가, eval 쓰는 도구는 전부 그쪽으로, 12300/websocket-server/runtime WS 클라이언트 제거 또는 옵션화.
- **개발툴**: 디버거 UI는 필수가 아니고, Metro + 앱만 있으면 CDP 전용 경로로 동작 가능.
