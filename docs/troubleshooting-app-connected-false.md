# appConnected: false, devices: [] 나올 때

`get_debugger_status`에서 `appConnected: false`, `devices: []`가 나오는 경우, **앱이 MCP 서버(WebSocket 포트 12300)에 연결되지 않은 상태**입니다.

## 동작 구조

- MCP 서버는 **12300 포트**에서 WebSocket 서버를 연다.
- 앱의 `runtime.js`는 **`ws://localhost:12300`**으로 이 서버에 접속한다.
- 접속 후 앱이 `init` 메시지를 보내면, 서버가 `devices`에 등록하고 `appConnected`가 true가 된다.

그래서 **앱이 12300에 한 번도 붙지 못하면** 계속 `appConnected: false`, `devices: []`만 보인다.

---

## 가능한 원인과 확인 방법

### 1. MCP 서버가 두 개 떠 있음 (가장 흔함)

- **Cursor**가 MCP를 켜서 프로세스 A가 생기고, 터미널에서 `npx @ohah/react-native-mcp-server` 등으로 **또 다른 프로세스 B**를 띄운 경우.
- 포트 12300은 **한 프로세스만** 쓸 수 있다. 먼저 뜬 쪽(A)만 12300 리스닝 성공하고, 나중에 뜬 쪽(B)은 `EADDRINUSE`로 리스닝 실패.
- 앱은 **12300을 쓰는 A**에만 붙고, Cursor는 **B**와 stdio로 통신하면 → Cursor 입장에서는 항상 `appConnected: false`.

**확인**

- 12300 사용 중인 프로세스가 몇 개인지 확인:
  ```bash
  lsof -i :12300
  ```
- Cursor MCP 로그에 `EADDRINUSE: address already in use :::12300` 있는지 확인.

**대응**

- MCP 서버는 **한 군데에서만** 실행: Cursor만 쓰거나, 터미널에서만 쓰기.
- 12300 선점 정리 후 한 번만 띄우기:
  ```bash
  kill $(lsof -t -i :12300)
  ```
  그 다음 Cursor만 켜거나, 터미널에서만 `npx ...` 실행.

---

### 2. Cursor가 띄운 프로세스가 12300 리스닝에 실패함

- MCP 서버는 한 개인데, **그 프로세스가 12300 바인드에 실패**한 경우(이전 프로세스가 완전히 정리되기 전에 시작 등).
- 이 경우 앱이 12300으로 접속해도 **받아주는 쪽이 없어서** 연결 실패 → `appConnected` 계속 false.

**확인**

- Cursor MCP 로그에 `WebSocket server listening on ws://localhost:12300`가 **반드시 한 번** 나오는지 확인.
- 위 메시지가 없고 `EADDRINUSE`만 있으면, 이 프로세스는 12300에서 리스닝하지 못한 상태.

**대응**

- `kill $(lsof -t -i :12300)` 후 Cursor 재시작(또는 MCP 새로고침)해서, Cursor가 띄운 프로세스가 12300을 쓰게 하기.

---

### 3. 앱이 “localhost”로 호스트에 도달하지 못함

- 런타임은 **`ws://localhost:12300`** 고정.
- **iOS 시뮬레이터**: 보통 `localhost`가 호스트 PC를 가리켜서 12300 접속 가능.
- **Android 에뮬레이터**: `localhost`는 에뮬 자신. 호스트는 `10.0.2.2`인데, 현재 런타임은 그걸 쓰지 않음 → **에뮬에서는 연결 불가**.
- **실기기(iOS/Android)**: `localhost`는 기기 자신. PC의 MCP 서버(12300)에 붙으려면 PC IP가 필요한데, **현재 런타임은 미지원** → 실기기에서는 연결 불가.

**확인**

- 지금 앱을 **어디에서** 실행 중인지 확인: iOS 시뮬 / Android 에뮬 / 실기기.
- 실기기나 Android 에뮬이면 `appConnected: false`는 정상일 수 있음.

**대응**

- **iOS 시뮬레이터**에서만 MCP 앱 연결을 쓰거나, 추후 런타임에서 PC IP/에뮬용 주소 설정이 지원되면 그때 실기기/에뮬 사용.

---

### 4. 앱 번들에 MCP 런타임이 없거나, 연결 코드가 실행되지 않음

- `__REACT_NATIVE_MCP__`가 없다면, 12300으로 접속하는 코드 자체가 번들에 없음.
- Babel preset은 넣었는데 **진입점이 해당 preset을 타지 않거나**, **캐시** 때문에 예전 번들이 로드되는 경우.
- **Release/비개발 빌드**: Metro를 `REACT_NATIVE_MCP_ENABLED=true` 로 실행하지 않으면 런타임이 12300에 연결하지 않음. 앱 진입점에 `enable()` 호출은 필요 없고, 환경변수로 활성화함.

**확인**

- 앱 로그에 `[MCP] runtime loaded, __REACT_NATIVE_MCP__ available`가 한 번 나오는지.
- 연결 성공 시 `[MCP] Connected to server ws://localhost:12300`가 나오는지.
- 없으면: Metro 캐시 리셋(`react-native start --reset-cache`) 후 앱 다시 빌드/실행. Release면 `REACT_NATIVE_MCP_ENABLED=true` 로 Metro 실행했는지 확인.

---

## 요약 표

| 상황                                 | 원인                                                                     |
| ------------------------------------ | ------------------------------------------------------------------------ |
| 로그에 EADDRINUSE (12300)            | MCP 서버 2개. 앱은 12300 쓰는 쪽에만 붙고, Cursor는 다른 프로세스 사용.  |
| 1프로세스, “listening on 12300” 없음 | 이번 프로세스가 12300 리스닝 실패.                                       |
| 1프로세스, iOS 시뮬만 사용           | 런타임 미주입 또는 Metro/캐시; 앱 로그에 `[MCP] runtime loaded` 확인.    |
| Android 에뮬 / 실기기                | localhost가 호스트가 아니라서 앱이 12300에 접속 불가 (현재 런타임 한계). |

---

## 권장 확인 순서

1. **12300 한 프로세스만 쓰는지**
   - `lsof -i :12300` → 한 프로세스만 나오게, 필요 시 `kill $(lsof -t -i :12300)` 후 MCP 한 번만 실행.
2. **Cursor MCP 로그**
   - `WebSocket server listening on ws://localhost:12300` 있는지, `EADDRINUSE` 없는지 확인.
3. **실행 환경**
   - iOS 시뮬인지, 에뮬/실기기인지 확인. (에뮬/실기기는 현재 지원 안 됨.)
4. **앱 로그**
   - `[MCP] runtime loaded` → `[MCP] Connected to server` 순서로 나오는지 확인.

이렇게 해도 `appConnected: false`면, 위 표와 문서의 “앱 연결 안 됨” 트러블슈팅(`troubleshooting-app-connection.md`)을 같이 참고하면 됩니다.
