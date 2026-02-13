# CDP 가로채기 라이브러리 제공 설계

Metro 쪽 패치(createDevMiddleware + customMessageHandler)를 **설치 가능한 라이브러리**로 제공할 때의 구조.

---

## 1. 제공 형태

- **패키지**: 기존 `@ohah/react-native-mcp-server` 안에 **진입점 하나** 추가.
- **진입점**: `metro.config.js`에서 **한 번만** require하면 되는 CJS 파일.
  - 예: `require('@ohah/react-native-mcp-server/cdp-interceptor')`
  - side-effect만 있으면 되고, export는 없어도 됨.

---

## 2. 진입점이 하는 일

1. **createDevMiddleware 패치**
   - `@react-native/dev-middleware`를 require한 뒤, `createDevMiddleware`를 래핑.
   - 래핑된 함수는 호출 시 **옵션에 unstable_customInspectorMessageHandler**를 넣어서 원본에 넘김.
   - customMessageHandler는 **디바이스→디버거, 디버거→디바이스 모든 CDP 메시지**를 수집해 **모듈 내부 저장소**에 push (Network, Console, Runtime, Debugger 등 전부).

2. **미들웨어에 이벤트 노출 라우트 추가**
   - `createDevMiddleware()` 반환값은 보통 `{ middleware, websocketEndpoints }`.
   - `middleware`를 한 번 감싸서: `req.url === '/__mcp_cdp_events__'` 이면 수집된 CDP 이벤트 배열을 JSON으로 응답 (`{ events: [...] }`).
   - 그 외는 기존 middleware 그대로 호출.

이렇게 하면 **Metro 서버에 GET /**mcp_cdp_events\*\*\*\* 가 생기고, MCP 서버(다른 프로세스)는 이 URL로 HTTP 요청해 전체 CDP 이벤트를 읽을 수 있음.

---

## 3. 파일 배치 (제안)

```
packages/react-native-mcp-server/
├── cdp-interceptor.cjs          # Metro용 진입점 (CJS, require 시 패치 적용)
├── src/
│   └── cdp/
│       ├── store.js             # 인메모리 저장소 (Network 이벤트 리스트)
│       └── custom-handler.js    # handleDeviceMessage 로직 (선택: CJS로 분리)
├── ...
```

- **cdp-interceptor.cjs**: Metro config 로드 시점에 실행되므로 **반드시 CJS**. `require('@react-native/dev-middleware')` 후 패치 + middleware 래핑.
- **store**: 같은 프로세스 안에서 customMessageHandler와 `/__mcp_network_log__` 핸들러가 공유하는 단일 저장소 (배열 또는 맵).
- `@react-native/dev-middleware`는 **앱(React Native) 쪽 dependency**이므로, 이 패키지의 dependency에 넣지 않고 **peerDependencies** 또는 문서로만 명시.

---

## 4. 사용자(앱) 측 사용법

**metro.config.js** 맨 위에 한 줄:

```js
require('@ohah/react-native-mcp-server/cdp-interceptor');

const path = require('path');
// ... 기존 config
module.exports = { ... };
```

- Metro를 띄우는 프로세스에서 위 config가 로드될 때 패치가 적용됨.
- **엔드포인트** `/__mcp_cdp_events__` 는 config require만으로 등록됨 (runServer 패치).
- **CDP 이벤트 수집**(콘솔/네트워크 등)을 쓰려면, CLI가 `@react-native/dev-middleware`를 require하기 **전에** Module.\_load 후크가 걸려 있어야 함. 따라서 Metro 시작 시 **node -r** 로 cdp-interceptor를 선로드해야 함:
  ```bash
  node -r @ohah/react-native-mcp-server/cdp-interceptor node_modules/.bin/react-native start --port 8230 --config ./metro.config.js
  ```
  package.json의 `scripts.start` 에 위 형태로 넣어 두면 `bun start` / `npm start` 시 이벤트가 수집됨.

---

## 5. MCP 서버와의 연동

- **list_cdp_events** / **list_network_requests** 등 도구: Metro가 떠 있는 **base URL** (예: `http://localhost:8230`)을 알고 있어야 함.
  - 환경 변수(예: `METRO_BASE_URL`) 또는 기본값(예: `http://localhost:8230`)으로 해결.
- 도구 내부에서 `fetch(METRO_BASE_URL + '/__mcp_cdp_events__')` 로 GET 후 JSON 파싱. 응답은 `{ events: Array<{ direction, method, params?, id?, timestamp }> }`. 클라이언트에서 `method.startsWith('Network.')` 등으로 필터링 가능.

---

## 6. 정리

| 항목                   | 내용                                                              |
| ---------------------- | ----------------------------------------------------------------- |
| 라이브러리 진입점      | `@ohah/react-native-mcp-server/cdp-interceptor` (CJS)             |
| 사용자 작업            | metro.config.js 상단에 require 1줄                                |
| 수집 대상              | 모든 CDP 이벤트 (device→debugger, debugger→device)                |
| 저장소                 | 패키지 내부 인메모리(최대 2000건), 같은 Metro 프로세스에서만 접근 |
| MCP가 이벤트 읽는 방법 | HTTP GET /**mcp_cdp_events** (Metro base URL 필요)                |

이렇게 하면 “Metro에 플러그인 추가하듯이” 한 줄만 넣어도 CDP 가로채기가 켜지고, MCP는 별도 프로세스에서도 HTTP로 전체 CDP 이벤트(콘솔·네트워크 등)를 가져갈 수 있음.
