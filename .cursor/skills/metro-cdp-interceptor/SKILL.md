---
name: metro-cdp-interceptor
description: Metro 래퍼(cdp-interceptor) 설정·동작·디버깅. cdp-interceptor, node -r, /__mcp_cdp_events__ 관련 시 참고.
---

# Metro CDP Interceptor 스킬

React Native MCP에서 콘솔/네트워크를 쓰려면 Metro에 **cdp-interceptor**가 적용돼야 한다.

## 1. 적용 방법

**1) metro.config.js 맨 위에 한 줄**

```js
require('@ohah/react-native-mcp-server/cdp-interceptor');

const path = require('path');
// ... 기존 config
module.exports = { ... };
```

엔드포인트 `GET /__mcp_cdp_events__`는 이만으로 등록된다. **이벤트 수집**은 2) 필요.

**2) Metro를 node -r 로 시작**

```bash
node -r @ohah/react-native-mcp-server/cdp-interceptor node_modules/.bin/react-native start --port 8230 --config ./metro.config.js
```

package.json 예:

```json
"start": "node -r @ohah/react-native-mcp-server/cdp-interceptor node_modules/.bin/react-native start --port 8230 --config ./metro.config.js"
```

- config만: `/__mcp_cdp_events__` 200, `events`는 [].
- node -r까지: 디버거 연결 시 콘솔·네트워크 등 CDP 이벤트 수집됨.

## 2. 동작 요약

| 단계                   | 하는 일                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Module.\_load 후크** | `dev-middleware` 로드 시 `createDevMiddleware` 래핑 → `unstable_customInspectorMessageHandler`로 eventStore에 push. |
| **runServer 패치**     | `unstable_extraMiddleware` 맨 앞에 `/__mcp_cdp_events__` 미들웨어 추가 (404 방지).                                  |
| **config 로드**        | getter-only export 덮어쓰지 않고, \_load 반환값(module.exports)을 Proxy로 감싼 뒤 반환.                             |

상세: `docs/cdp-interceptor-library-design.md`

## 3. 문제 시 확인

- **404** → runServer 패치 미적용. Metro 재시작·cwd 기준 metro resolve 확인.
- **200인데 events 항상 []** → Metro를 **node -r** 로 시작했는지, 디버거 한 번이라도 연결했는지 확인.
- **exports 경고** → package.json `exports`에 `"./runtime": "./runtime.js"` 포함.

## 4. 참고 경로

- 진입점: `packages/react-native-mcp-server/cdp-interceptor.cjs`
- 설계: `docs/cdp-interceptor-library-design.md`
- 도구: `packages/react-native-mcp-server/src/tools/metro-cdp.ts`, list-console-messages.ts, list-network-requests.ts
