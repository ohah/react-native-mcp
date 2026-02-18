# CDP 이벤트 수집 설계

Metro에서 CDP(Chrome DevTools Protocol) 이벤트를 수집하는 구조.

---

## 1. 현재 구현: 직접 CDP WebSocket 연결

### 1.1 개요

MCP 서버가 Metro의 `/json` 엔드포인트에서 디버거 타겟을 발견하고, `webSocketDebuggerUrl`로 직접 WebSocket 연결. `node -r`이나 `metro.config.js` 수정 불필요.

### 1.2 흐름

```
RN 앱 시작
  → runtime.js가 ws://localhost:12300 (MCP 서버)에 연결
  → { type: 'init', metroBaseUrl: 'http://localhost:8230' } 전송
  → MCP 서버가 GET http://localhost:8230/json 으로 타겟 목록 조회
  → webSocketDebuggerUrl로 CDP WebSocket 연결
  → Runtime.enable, Network.enable, Log.enable 전송
  → CDP 이벤트를 in-memory 배열에 push (최대 2000건)
```

### 1.3 핵심 코드

```
packages/react-native-mcp-server/
├── src/
│   ├── tools/
│   │   └── metro-cdp.ts          # CdpClient 싱글톤: /json → WebSocket → 이벤트 수집
│   ├── websocket-server.ts       # 앱 init 수신 → setMetroBaseUrlFromApp() 호출
│   └── __tests__/
│       └── metro-cdp.test.ts     # CdpClient 테스트 (mock Metro/CDP 서버)
└── runtime.js                    # 앱 측: metroBaseUrl 전송
```

### 1.4 CdpClient 클래스

```typescript
class CdpClient {
  async connect(metroBaseUrl: string); // /json fetch → WebSocket 연결 → 도메인 활성화
  disconnect(); // WebSocket 종료 + reconnect 타이머 취소
  getEvents(): CdpEventEntry[]; // in-memory 이벤트 반환
  getLastEventTimestamp(): number | null;
  isConnected(): boolean; // WebSocket.OPEN 상태 확인
}
```

- **자동 재연결**: WebSocket 끊어지면 2초 후 `connect()` 재시도
- **이벤트 필터링**: `method`가 있는 메시지만 수집 (CDP 응답(id-only)은 무시)

### 1.5 장점

- **설정 제로**: 사용자가 `node -r`이나 config 수정할 필요 없음
- **프로세스 독립**: Metro와 같은 프로세스가 아니어도 동작
- **Metro 포트 자동 감지**: 앱이 `NativeModules.SourceCode.scriptURL`에서 origin 추출

### 1.6 제약

- **타겟당 디버거 1개**: Metro는 같은 타겟에 WebSocket 1개만 허용. MCP가 연결 중이면 Chrome DevTools는 같은 타겟에 연결 불가.
- **Android + iOS 동시 가능**: 별도 타겟이므로 충돌 없음.

---

## 2. MCP 서버와의 연동

### 2.1 이벤트 조회

CDP 이벤트 HTTP 조회(`fetchCdpEvents`, `GET /__mcp_cdp_events__`)는 제거됨.  
`list_console_messages`, `list_network_requests`는 stub 상태로 index에 미등록.

### 2.2 도구에서 사용

- `get_debugger_status`: 앱 WebSocket 연결 상태(appSession) 확인

---

## 3. 테스트

```bash
bun test packages/react-native-mcp-server/src/__tests__/metro-cdp.test.ts
```

- Mock HTTP + WebSocket 서버로 Metro 시뮬레이션
- 자동 연결, 도메인 활성화, 이벤트 수집, disconnect, CDP 응답 필터링 검증
