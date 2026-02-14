---
name: metro-cdp-interceptor
description: Metro CDP 직접 연결 아키텍처·동작·디버깅. CDP 이벤트, 콘솔/네트워크 수집, getDebuggerStatus 관련 시 참고.
---

# Metro CDP 직접 연결 스킬

React Native MCP에서 콘솔/네트워크 이벤트를 수집하는 구조. `node -r`이나 `metro.config.js` 수정 불필요.

## 1. 동작 흐름

```
앱 연결 → metroBaseUrl 전송 → MCP 서버가 /json에서 타겟 발견
→ CDP WebSocket 직접 연결 → Runtime/Network/Log.enable
→ 이벤트 in-memory 수집
```

| 단계              | 위치                     | 하는 일                                                                      |
| ----------------- | ------------------------ | ---------------------------------------------------------------------------- |
| **앱 init**       | `websocket-server.ts:57` | 앱이 `{ type: 'init', metroBaseUrl }` 전송 → `setMetroBaseUrlFromApp()` 호출 |
| **CDP 연결**      | `metro-cdp.ts:34-51`     | `GET /json`으로 타겟 발견 → `webSocketDebuggerUrl`로 WebSocket 연결          |
| **도메인 활성화** | `metro-cdp.ts:81-84`     | `Runtime.enable`, `Network.enable`, `Log.enable` 전송                        |
| **이벤트 수집**   | `metro-cdp.ts:88-101`    | CDP 이벤트(method 있는 메시지)를 in-memory 배열에 push (최대 2000개)         |
| **이벤트 조회**   | `metro-cdp.ts:145-153`   | `fetchCdpEvents()` / `fetchCdpEventsRaw()`로 메모리에서 직접 반환            |

## 2. 설정 (추가 설정 없음)

MCP 서버가 자동으로 처리. metro.config.js나 package.json 수정 불필요.

```json
// package.json — 그냥 평범하게 Metro 시작
"start": "react-native start --port 8230 --config ./metro.config.js"
```

Metro 포트는 앱이 `NativeModules.SourceCode.scriptURL`에서 origin을 추출해 전송하므로 자동 감지.

## 3. 핵심 코드

### CdpClient (싱글톤)

```typescript
// metro-cdp.ts
class CdpClient {
  async connect(metroBaseUrl: string); // /json fetch → WebSocket 연결
  disconnect(); // WebSocket 종료 + reconnect 취소
  getEvents(): CdpEventEntry[]; // in-memory 이벤트 반환
  isConnected(): boolean; // WebSocket 상태
}
```

### 연결 트리거

```typescript
// setMetroBaseUrlFromApp — websocket-server.ts에서 호출
export function setMetroBaseUrlFromApp(url: string | null): void {
  if (url)
    cdpClient.connect(url); // 앱 연결 시
  else cdpClient.disconnect(); // 앱 해제 시
}
```

## 4. 제약사항

- **디버거 1개**: Metro는 타겟당 WebSocket 1개만 허용. MCP가 연결 중이면 Chrome DevTools는 같은 타겟에 연결 불가.
- **Android + iOS 동시 가능**: 각각 별도 타겟이므로 충돌 없음.
- **reconnect**: WebSocket 끊어지면 2초 후 자동 재연결 시도.

## 5. 문제 시 확인

- **`get_debugger_status` → connected: false**
  - 앱이 MCP 서버(ws://localhost:12300)에 연결됐는지 확인
  - Metro가 실행 중인지 확인 (`curl http://localhost:8230/json`)
  - 다른 디버거(Chrome DevTools)가 같은 타겟에 연결돼 있지 않은지 확인
- **이벤트가 수집되지 않음**
  - `connected: true`인데 이벤트가 없으면 앱에서 콘솔/네트워크 활동이 없는 상태
  - CDP 응답(id만 있는 메시지)은 의도적으로 필터링됨
- **MCP 서버 프로세스 중복**
  - `lsof -i :12300`으로 확인. 두 프로세스가 있으면 이전 프로세스 kill

## 6. 레거시: cdp-interceptor.cjs

`cdp-interceptor.cjs`는 Module.\_load 후크 방식의 레거시 코드. 직접 CDP 연결이 도입되면서 **더 이상 필요하지 않음**.

- ~~`require('@ohah/react-native-mcp-server/cdp-interceptor')`~~ → 불필요
- ~~`node -r @ohah/react-native-mcp-server/cdp-interceptor`~~ → 불필요
- ~~`GET /__mcp_cdp_events__`~~ → in-memory 직접 조회로 대체

## 7. 참고 경로

- CDP 클라이언트: `packages/react-native-mcp-server/src/tools/metro-cdp.ts`
- WebSocket 서버: `packages/react-native-mcp-server/src/websocket-server.ts`
- 런타임 (앱 측): `packages/react-native-mcp-server/runtime.js`
- 도구: `src/tools/get-debugger-status.ts`, `list-console-messages.ts`, `list-network-requests.ts`
- 테스트: `src/__tests__/metro-cdp.test.ts`
