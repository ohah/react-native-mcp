# 문제 해결

React Native MCP 사용 시 자주 발생하는 문제와 해결 방법입니다.

---

## "No app connected" / `appConnected: false`

`get_debugger_status`에서 `appConnected: false`, `devices: []`가 나오면, 앱이 MCP 서버의 WebSocket(포트 12300)에 연결되지 않은 상태입니다.

### 동작 구조

- MCP 서버는 **12300 포트**에서 WebSocket 서버를 엽니다.
- 앱의 런타임이 `ws://localhost:12300`으로 서버에 접속합니다.
- 접속 후 앱이 `init` 메시지를 보내면 서버가 디바이스를 등록하고 `appConnected`가 `true`가 됩니다.

앱이 12300에 한 번도 연결되지 못하면 `appConnected: false`가 계속됩니다.

### 원인 1: MCP 서버가 두 개 실행됨 (가장 흔함)

**현상**: Cursor가 MCP 프로세스 A를 시작하고, 터미널에서 `npx @ohah/react-native-mcp-server`로 프로세스 B를 추가로 실행한 경우. 포트 12300은 하나의 프로세스만 사용할 수 있어서, 먼저 실행된 쪽만 성공하고 나머지는 `EADDRINUSE` 에러가 발생합니다.

앱은 12300을 소유한 프로세스(A)에만 연결되지만, Cursor는 다른 프로세스(B)와 stdio로 통신하므로 항상 `appConnected: false`로 보입니다.

**확인**:

```bash
lsof -i :12300
```

여러 프로세스가 나오면 이 문제입니다.

**해결**:

```bash
kill $(lsof -t -i :12300)
```

이후 MCP 서버를 **한 곳에서만** 실행하세요 — Cursor 또는 터미널 중 하나만.

### 원인 2: 포트 12300 바인드 실패

프로세스가 하나뿐이어도, 이전 프로세스가 완전히 종료되기 전에 새 프로세스가 시작되면 바인드에 실패할 수 있습니다.

**확인**: MCP 로그에서 `WebSocket server listening on ws://localhost:12300`이 있는지 확인. 없고 `EADDRINUSE`만 있다면 리스닝에 실패한 것입니다.

**해결**: 포트를 정리하고 MCP 서버 또는 Cursor를 재시작하세요.

### 원인 3: 앱이 localhost로 호스트에 도달 못함

런타임은 `ws://localhost:12300`을 사용합니다.

| 환경               | localhost 가리키는 곳 | 연결                                   |
| ------------------ | --------------------- | -------------------------------------- |
| iOS 시뮬레이터     | 호스트 PC             | 동작                                   |
| Android 에뮬레이터 | 에뮬레이터 자신       | `adb reverse tcp:12300 tcp:12300` 필요 |
| 실기기             | 기기 자신             | 미지원 (호스트 IP 필요)                |

**해결**: Android 에뮬레이터에서는 다음 실행:

```bash
adb reverse tcp:12300 tcp:12300
```

### 원인 4: 앱 번들에 MCP 런타임이 없음

`__REACT_NATIVE_MCP__`가 존재하지 않으면 런타임이 주입되지 않은 것입니다.

**확인**: 앱 로그에서 `[MCP] runtime loaded, __REACT_NATIVE_MCP__ available` 확인.

**해결**:

1. `babel.config.js`에 `@ohah/react-native-mcp-server/babel-preset`이 있는지 확인
2. Metro 캐시 초기화 후 재빌드:
   ```bash
   npx react-native start --reset-cache
   # 또는 Expo
   npx expo start --clear
   ```
3. 비개발 빌드에서는 Metro를 `REACT_NATIVE_MCP_ENABLED=true`로 실행

### 요약 표

| 증상                                 | 원인                                                    |
| ------------------------------------ | ------------------------------------------------------- |
| 로그에 `EADDRINUSE`                  | MCP 서버 2개 — 앱은 하나에 붙고 Cursor는 다른 것을 사용 |
| 1프로세스, "listening on 12300" 없음 | 이 프로세스가 12300 바인드에 실패                       |
| 1프로세스, iOS 시뮬 사용             | 런타임 미주입 또는 Metro 캐시 문제                      |
| Android 에뮬/실기기                  | localhost가 호스트가 아니라 앱이 서버에 접속 불가       |

---

## tap / 스크린샷이 안 될 때

### iOS 시뮬레이터

- **idb 필요**: [idb](https://fbidb.io/) 설치:
  ```bash
  brew tap facebook/fb && brew install idb-companion
  pip3 install fb-idb
  ```
- **확인**: `idb list-targets`에 시뮬레이터가 표시되어야 합니다
- **시뮬레이터 부팅**: 필요 시 `xcrun simctl boot <UDID>`

### Android 에뮬레이터/기기

- **adb 필요**: Android Studio에 포함, 또는:
  ```bash
  brew install --cask android-platform-tools
  ```
- **확인**: `adb devices`에 디바이스가 표시되어야 합니다
- **포트 포워딩**: `adb reverse tcp:12300 tcp:12300`

### 공통 문제

- **좌표가 틀림**: 탭이 엉뚱한 곳에 입력되면 좌표계를 확인하세요 (iOS는 points, Android는 dp). `query_selector`로 정확한 좌표를 얻을 수 있습니다.
- **가로 모드**: iOS 가로 모드에서는 tap/swipe 도구에 `iosOrientation` 파라미터를 전달하세요.

---

## Metro 캐시 문제

Babel 설정 변경이나 MCP 패키지 업데이트 후에는 Metro 캐시를 정리하세요:

```bash
# Bare RN
npx react-native start --reset-cache

# Expo
npx expo start --clear
```

---

## 권장 진단 순서

1. **MCP 서버 프로세스가 하나인지 확인**

   ```bash
   lsof -i :12300
   ```

   프로세스가 하나만 있어야 합니다. 여러 개면 `kill $(lsof -t -i :12300)` 후 재시작.

2. **MCP 로그 확인**
   - 있어야 함: `WebSocket server listening on ws://localhost:12300`
   - 없어야 함: `EADDRINUSE`

3. **실행 환경 확인**
   - iOS 시뮬레이터, Android 에뮬레이터(`adb reverse` 적용), 또는 개발 빌드
   - 실기기는 추가 네트워크 설정 필요

4. **앱 로그 확인**
   - `[MCP] runtime loaded, __REACT_NATIVE_MCP__ available` — 런타임 주입됨
   - `[MCP] Connected to server ws://localhost:12300` — 서버에 연결됨

5. **연결 테스트**
   - `get_debugger_status` 호출 — devices 목록에 디바이스가 표시되어야 함
   - `evaluate_script`에 `() => 1 + 2` 전달 — `3`이 반환되면 정상
