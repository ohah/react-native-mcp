# 네트워크 모니터링: Metro/InspectorProxy + CDP 분석

상위 폴더 **bungae/reference** (번개번들러 레퍼런스)의 **React Native dev-middleware** 및 **chrome-remote-devtools**의 Metro 디버거 연동을 기준으로, “Metro 쪽에서 CDP 이벤트를 가로채서 네트워크 모니터링이 가능한지” 정리한 문서입니다.

---

## 1. 결론 요약

| 질문                                                 | 답변                                                                                                                                                                                |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Metro **서버 프로세스**에서 CDP 이벤트를 볼 수 있나? | **가능하다.** 단, “Metro”만이 아니라 **React Native의 dev-middleware(InspectorProxy)**가 같은 서버에 붙어 있을 때.                                                                  |
| CDP 트래픽이 지나가는 곳                             | **InspectorProxy**가 디바이스(앱)와 디버거(Chrome DevTools) 사이에서 **모든 CDP 메시지를 중계**한다.                                                                                |
| 네트워크 이벤트 가로채기                             | **CustomMessageHandler**로 디바이스→디버거 방향 메시지를 읽을 수 있음. `Network.requestWillBeSent` / `Network.responseReceived` 등이 오면 수집 가능.                                |
| 제약                                                 | **Hermes**는 CDP에서 Debugger/Runtime 위주 지원. **Network 도메인**은 Hermes 쪽에 없을 수 있어, “디버거 연결 방식”(레거시 Chrome 실행 vs Hermes on device)에 따라 동작 여부가 갈림. |

---

## 2. React Native 쪽 구조 (reference/react-native)

### 2.1 Metro와 디버거의 관계

- **Metro** 자체는 번들 서빙만 하고, `/json/list`를 제공하지 않음.
- **React Native**는 `@react-native/dev-middleware`에서 **InspectorProxy**를 쓰고, 이게 Metro(또는 개발 서버)에 **미들웨어**로 붙는다.
- 사용자가 “디버거 열기”를 하면:
  - 앱(디바이스)이 **WebSocket**으로 `Metro주소/inspector/device`에 연결하고,
  - Chrome DevTools(또는 Fusebox)는 **Metro주소/json/list**로 타깃 목록을 받은 뒤,
  - 각 타깃의 **webSocketDebuggerUrl** (`/inspector/debug?device=...&page=...`) 로 WebSocket 연결한다.
- 따라서 **실제 CDP 트래픽은 모두 InspectorProxy(즉, Metro와 같은 프로세스에 붙은 서버)를 통과**한다.

참고 코드 (bungae/reference/react-native/packages/dev-middleware):

- `inspector-proxy/InspectorProxy.js`: `/json`, `/json/list` 제공, `webSocketDebuggerUrl` 생성.
- `inspector-proxy/Device.js`: 디바이스 WebSocket ↔ 디버거 WebSocket 중계, **CustomMessageHandler** 호출.

### 2.2 chrome-remote-devtools 쪽

- `get-metro-targets.ts`: **Metro base URL + `/json/list`** 로 타깃 목록 조회.
- 각 타깃의 `webSocketDebuggerUrl`, `devtoolsFrontendUrl` 사용.
- Metro 디버거 페이지는 `devtoolsFrontendUrl`을 iframe으로 띄우고, 그 프론트엔드가 `webSocketDebuggerUrl`로 CDP 연결.

즉, “Metro 서버에서 CDP를 활용한다”는 말은 **Metro에 붙은 InspectorProxy를 통해 CDP가 지나간다**는 의미로 이해하면 됨.

---

## 3. CDP 메시지 가로채기 (가능한지)

### 3.1 InspectorProxy의 CustomMessageHandler

- **InspectorProxy** 생성 시 `customMessageHandler: CreateCustomMessageHandlerFn` 를 넘길 수 있음.
- **Device**는 디버거 연결마다 이 핸들러를 만들고, **디바이스 → 디버거**로 가는 CDP 메시지에 대해 `handleDeviceMessage(message)` 를 호출한다.

```text
Device.js (참고)
  #handleMessageFromDevice(message)
    → message.event === 'wrappedEvent'
    → parsedPayload = JSON.parse(message.payload.wrappedEvent)  // 실제 CDP 메시지
    → debuggerConnection.customHandler?.handleDeviceMessage(parsedPayload)
    → true 반환 시 디버거로 전달 안 함, 아니면 그대로 전달
```

- 따라서 **InspectorProxy를 통해 지나가는 모든 CDP 메시지(이벤트 포함)**를 여기서 읽을 수 있다.
- 네트워크 모니터링을 하려면:
  - `handleDeviceMessage` 안에서 `method === 'Network.requestWillBeSent'`, `'Network.responseReceived'` 등만 필터링해 수집하면 됨.
  - 수집만 하고 `return` 하지 않으면(또는 `void` 반환) 메시지는 그대로 디버거에도 전달되므로, 기존 디버거 동작은 유지된다.

### 3.2 디버거 → 디바이스 방향

- `CustomMessageHandler.handleDebuggerMessage(message)` 도 있음.
- 디버거가 보내는 `Network.enable` 등도 여기서 볼 수 있음 (필요 시 수집/로깅 가능).

---

## 4. Network 도메인 지원 여부 (제약)

- **CDP 이벤트를 Metro(InspectorProxy)에서 가로채는 것** 자체는 위 구조로 가능하다.
- 다만 **디바이스(Hermes)가 CDP로 Network 도메인 이벤트를 보내는지**는 별도 이슈다.
- 공개 문서([cdpstatus.reactnative.dev](https://cdpstatus.reactnative.dev/devtools-protocol/hermes/Debugger)) 기준:
  - Hermes CDP: **Debugger**, **Runtime** 도메인 위주.
  - **Network** 도메인은 브라우저(Chrome) 쪽 개념이라, Hermes inspector 구현에는 없을 가능성이 크다.
- 따라서:
  - **Hermes on device** 로만 디버깅할 때: InspectorProxy에서 가로채는 메시지에 `Network.*` 이벤트가 **없을 수 있음** → 네트워크 모니터링 불가.
  - **레거시 “Debug with Chrome”** (JS가 Chrome에서 실행): Chrome이 CDP를 제공하므로 `Network.*` 이벤트가 **있을 수 있음** → 가로채기로 네트워크 모니터링 가능.

정리하면, “가능한지”에 대한 답은 **구현 경로는 있다 (InspectorProxy + CustomMessageHandler). 실제로 네트워크가 보이느냐는 디버깅 방식(Hermes vs Chrome)과 Hermes의 CDP 지원 범위에 달려 있다**는 정도로 두는 게 맞다.

### 4.5 코드로 확인한 내용 (추가 분석)

- **Hermes / RN 코어**: dev-middleware에는 디바이스가 `Network.requestWillBeSent` 등을 **보내는** 코드가 없고, `enableNetworkInspector`는 프론트 URL에 Network **패널**만 켤 뿐이다. Device.js는 `Network.loadNetworkResource`(디버거→디바이스)만 처리.
- **chrome-remote-devtools** `react-native-inspector`: `cdp/domain/network.ts`에서 fetch/XHR 훅 후 `sendCDPEvent`로 `Network.requestWillBeSent`, `Network.responseReceived` 등을 보내지만, 연결 대상은 **Chrome Remote DevTools 서버**(`/remote/debug/inspector/device`)라 **Metro InspectorProxy를 타지 않는다.**
- **표준 RN + Metro**: 디바이스 = Hermes inspector → Metro로 오가는 CDP에 **Network.\* 이벤트는 없음.** 코드 기준으로 "Hermes on device만 쓰면 Network 이벤트가 없다"는 것을 **단정**할 수 있다.

---

## 5. react-native-mcp 쪽에 적용하려면

1. **MCP 서버가 Metro와 같은 머신에서 동작**한다고 가정할 때:
   - **옵션 A**: React Native dev server(Metro + InspectorProxy)를 띄우는 쪽에서 **InspectorProxy에 CustomMessageHandler를 주입**하는 코드를 추가.
     - 이 핸들러에서 `Network.*` 이벤트만 수집해, MCP 서버로 보내는 채널(예: WebSocket, 파일, 메모리 큐)에 넣고, MCP 도구 `list_network_requests` 는 그 저장소를 읽어서 반환.
   - **옵션 B**: MCP 서버가 **Metro의 `/json/list`**를 주기적으로 호출해 `webSocketDebuggerUrl`을 얻고, **별도 CDP 클라이언트**로 그 WebSocket에 연결한 뒤 `Network.enable()` + 이벤트 수신.
     - 이때는 “디버거가 하나 더 붙는” 형태가 되므로, 기존 DevTools와 충돌/제한이 없는지 확인이 필요함 (일부 환경에서는 디버거 1개만 허용 등).

2. **앱 코드 수정 없이** 하려면 위의 **InspectorProxy 확장** 또는 **CDP 클라이언트로 webSocketDebuggerUrl 연결**이 필요하고,
   **Hermes만 쓰는 현재 기본 구성**에서는 Network 이벤트가 없을 수 있으므로, 그 경우에는 예전에 논의한 **앱 런타임에서 fetch/XHR 패치** 방식이 여전히 필요하다.

---

## 6. 참고 경로 (bungae / chrome-remote-devtools)

- `bungae/reference/react-native/packages/dev-middleware/src/`
  - `inspector-proxy/InspectorProxy.js` – `/json/list`, WebSocket 서버(device/debug), customMessageHandler 주입.
  - `inspector-proxy/Device.js` – 메시지 중계, `handleDeviceMessage` / `handleDebuggerMessage` 호출.
  - `inspector-proxy/CustomMessageHandler.js` – 인터페이스 정의.
- `chrome-remote-devtools/`
  - `packages/react-native-devtools/.../get-metro-targets.ts` – Metro `/json/list` 조회.
  - `packages/react-native-devtools/.../MetroDebuggerPage.tsx` – DevTools iframe + `devtoolsFrontendUrl`.
  - `packages/react-native-inspector/src/cdp/domain/network.ts` – fetch/XHR 훅, `Network.requestWillBeSent`·`responseReceived` 전송 (연결은 별도 서버).
  - `packages/react-native-inspector/src/websocket-client.ts` – `buildInspectorDeviceUrl` → `/remote/debug/inspector/device` (Metro 아님).

이 문서는 “Metro(실제로는 Metro에 붙은 InspectorProxy)에서 CDP 이벤트를 가로챌 수 있는지”에 대한 분석 결과이며, react-native-mcp의 `list_network_requests` 구현 시 참고용으로 둔 것이다.
