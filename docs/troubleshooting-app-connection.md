# 앱 연결 안 됨(No React Native app connected) 원인 분석

MCP 도구 호출 시 "No React Native app connected"가 나올 때 가능한 원인과 확인 방법.

## 구조 요약

- **Cursor** → stdio로 **MCP 서버 1개** 실행 (또는 사용자가 터미널에서 별도 실행).
- MCP 서버는 **WebSocket 서버(12300)** 를 띄우고, **앱**이 `ws://localhost:12300`으로 접속해야 함.
- `appSession.isConnected()` = 이 프로세스의 WebSocket 서버에 **앱이 한 개 붙어 있는지** 여부.

---

## 원인 1: MCP 서버가 두 개 뜨고, 앱은 다른 프로세스에 붙어 있음 (2프로세스)

### 현상

- Cursor가 MCP를 켤 때 한 프로세스, 터미널에서 또 `npx @ohah/react-native-mcp-server` 실행 등으로 **서버가 두 개** 떠 있음.
- 포트 12300은 **한 프로세스만** 선점 가능. 나머지 하나는 `listen` 시 **EADDRINUSE**.

### 동작

1. **프로세스 A**: 먼저 `appSession.start(12300)` → `new WebSocketServer({ port: 12300 })` 호출.
   `listen(port)`는 **비동기**이므로, 직후에 "WebSocket server listening on ws://localhost:12300" 로그를 찍고, 곧이어 실제로 12300 바인드 성공.
2. **프로세스 B**: 나중에 `appSession.start(12300)` → 같은 포트로 바인드 시도 → **EADDRINUSE** → `server.on('error')`만 발생.
   기존 코드는 에러만 로그하고 **프로세스는 계속 실행** (stdio로 Cursor와 연결된 쪽이 B일 수 있음).
3. **앱**: `ws://localhost:12300`으로 접속 → **A**에만 연결됨 (B는 12300 리스닝 실패로 접속 수신 불가).
4. **Cursor 도구**: 요청이 **B**로 감 → B의 `appSession.ws`는 항상 null → "No React Native app connected".

### 정리

- **앱은 A에 붙어 있고, Cursor는 B를 쓰는** 구조라 서로 다른 프로세스를 보는 상태.
- 2프로세스일 때만 발생. 1프로세스면 이 현상은 아님.

### 확인/대응

- 로그에 `WebSocket server error: listen EADDRINUSE: address already in use :::12300` 있는지 확인.
- 12300 사용 중인 프로세스 정리: `kill $(lsof -t -i :12300)` 후, MCP 서버는 **한 군데에서만** 실행 (Cursor만 쓰거나, 터미널만 쓰기).

---

## 원인 2: 서버는 1개인데도 앱 연결을 감지 못함 (1프로세스)

이 경우 **이 프로세스의 12300에는 앱이 접속하지 않은 상태**다.

### 2-1. 앱 번들에 MCP 런타임이 없음

- 런타임은 Metro **transformer**가 앱 진입점(`AppRegistry.registerComponent` 있는 파일)에만 주입함.
- 해당 파일이 transformer를 타지 않거나, 캐시/설정 문제로 주입이 빠지면 `__REACT_NATIVE_MCP__`·WebSocket 연결 코드가 실행되지 않음.

**확인**: 앱 진입점이 `babelTransformerPath: mcpTransformerPath`(또는 동일 transformer)를 쓰는지, Metro 캐시 리셋 후 다시 빌드해 보기.

### 2-2. 앱에서 WebSocket 연결 실패 (주소/환경)

- **iOS 시뮬레이터**: `localhost` = 호스트 PC → `ws://localhost:12300`으로 호스트의 MCP 서버 접속 가능.
- **Android 에뮬레이터**: `localhost` = 에뮬레이터 자신. 호스트 PC는 `10.0.2.2`.
  현재 런타임은 `ws://localhost:12300` 고정이라, **Android 에뮬에서는 MCP 서버에 접속할 수 없음**.
- **실기기**: `localhost`는 기기 자신. 같은 PC의 MCP 서버에 붙으려면 PC IP로 접속해야 함 (현재 런타임은 미지원).

정리하면, **Android 에뮬/실기기**에서는 앱이 서버에 붙지 못해 1프로세스여도 "앱 연결 안 됨"이 나올 수 있음.

### 2-3. Cursor가 띄운 프로세스가 12300 바인드에 실패한 경우

- 1프로세스만 있어도, 그 프로세스가 **이전에 12300을 쓰던 프로세스가 완전히 정리되기 전에** 뜨면 EADDRINUSE로 **이번 프로세스가 리스닝 실패**할 수 있음.
- 그러면 "서버 1개만 있는데" 그 서버는 12300에서 리스닝하지 못하고, 앱은 12300으로 접속 시도 → 아무도 받지 못함 → 이 프로세스의 `appSession.ws`는 계속 null.

---

## 요약 표

| 상황                       | 원인                                                                |
| -------------------------- | ------------------------------------------------------------------- |
| 로그에 EADDRINUSE          | MCP 서버 2개, 앱은 12300 선점한 쪽에만 붙음. Cursor는 다른 쪽을 씀. |
| 1프로세스, iOS 시뮬만 사용 | 런타임 미주입 또는 Metro/캐시 이슈.                                 |
| 1프로세스, Android 에뮬    | `localhost`가 호스트가 아니라서 앱이 서버에 접속 불가.              |
| 1프로세스, 실기기          | `localhost`가 기기 자신이라 호스트 MCP 서버에 접속 불가.            |

되돌린 코드에는 2프로세스 대응(EADDRINUSE 시 exit 등)을 넣지 않았으므로, 포트 충돌 시에는 사용자가 12300 사용 프로세스를 정리하고 MCP 서버를 한 군데만 두는 방식으로 대응해야 함.

---

## Metro 쪽에서 정상 동작을 위해 필요한 것

아래가 모두 되어 있어야 앱에 MCP 런타임이 들어가고, CDP 기반 도구가 동작한다.

1. **MCP transformer 사용**
   - `metro.config.js`의 `transformer.babelTransformerPath`가 **MCP transformer**를 가리켜야 함.
   - 예: `babelTransformerPath: path.resolve(workspaceRoot, 'packages/react-native-mcp-server/metro-transformer.cjs')`
   - 이게 없거나 잘못된 경로면 `AppRegistry.registerComponent` 치환·런타임 주입이 안 되어, 앱이 `ws://localhost:12300`에 접속하지 않음.

2. **앱 진입점에 `AppRegistry.registerComponent` 포함**
   - MCP transformer는 **`AppRegistry.registerComponent`가 포함된 파일**만 런타임 주입 대상으로 처리함.
   - 진입점(예: `index.js` 또는 루트 컴포넌트를 등록하는 파일)이 이 transformer를 **반드시 타도록** 되어 있어야 함. (`node_modules` 안 파일은 transformer에서 제외됨.)

3. **모노레포인 경우**
   - `watchFolders`에 워크스페이스 루트 포함 → MCP 패키지 경로를 Metro가 볼 수 있음.
   - `resolver.nodeModulesPaths`에 앱·워크스페이스의 `node_modules` 포함 → `@ohah/react-native-mcp-server` 등이 resolve됨.

4. **캐시**
   - 설정이나 transformer를 바꾼 뒤에는 **Metro 캐시 리셋** 후 다시 번들링하는 것이 안전함.
     예: `react-native start --reset-cache` 또는 `bun run start:reset`.

정리: **babelTransformerPath → MCP transformer** + **진입점이 해당 transformer를 타는지** + (모노레포면 watchFolders·resolver) + **필요 시 캐시 리셋**.

### Metro에서 연결이 제대로 안 될 때 점검할 원인

아래를 순서대로 확인하면 된다.

| #   | 원인                                              | 확인 방법                                                                                                                                                                                                         |
| --- | ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Metro를 MCP 설정 없는 config로 실행**           | 반드시 `--config ./metro.config.js` 로 실행. `package.json`의 start가 `--config ./metro.config.js` 포함하는지 확인. 기본 config만 쓰면 transformer가 적용되지 않음.                                               |
| 2   | **캐시에 예전 번들이 남아 있음**                  | `react-native start --reset-cache` 또는 `bun run start:reset` 으로 캐시 삭제 후 앱 다시 빌드.                                                                                                                     |
| 3   | **진입점이 transformer를 안 탐**                  | 진입점 파일(예: `index.js`) 경로에 `node_modules`가 들어가면 transformer가 스킵함. 진입점은 앱 루트의 `index.js` 등이어야 함.                                                                                     |
| 4   | **진입점에 `AppRegistry.registerComponent` 없음** | transformer는 이 문자열이 **그 파일 소스에 포함된 경우에만** 런타임 주입. 진입점이 `import './App'` 만 하고 App 쪽에 registerComponent 있으면, **App이 있는 파일**이 변환 대상. 그 파일이 node_modules 밖이면 됨. |
| 5   | **transformer-entry 미빌드**                      | `packages/react-native-mcp-server/dist/transformer-entry.js` 가 없으면 transformer 로드 시 에러. `bun run build` (또는 해당 패키지 build) 후 dist 생성 여부 확인.                                                 |
| 6   | **모노레포에서 resolver/watchFolders 누락**       | 앱을 모노레포 루트에서 실행할 때 `watchFolders`, `resolver.nodeModulesPaths` 에 워크스페이스 루트·패키지 경로가 없으면 `@ohah/react-native-mcp-server` resolve 실패할 수 있음.                                    |

**요약**: MCP용 Metro 동작을 보려면 **(1) MCP 포함한 config로 실행 (2) 캐시 리셋 (3) 진입점/App 파일이 node_modules 밖이고 registerComponent 포함 (4) dist 빌드됨 (5) 모노레포면 resolver/watchFolders 설정**.

### 직접 확인 결과 (번들 검사)

- `examples/demo-app`에서 **동일 config + reset-cache**로 번들 생성 시:
  - `react-native bundle --platform ios --entry-file index.js --bundle-output /tmp/demo-app-bundle.js --config ./metro.config.js --reset-cache`
- 생성된 번들 안에 **`@ohah/react-native-mcp-server/runtime`**, **`__REACT_NATIVE_MCP__`**, **`[MCP] runtime loaded`**, **`12300`** 등이 포함됨 → **transformer는 정상 적용됨.**

따라서 **앱이 12300에 안 붙는 경우**에는:

- **지금 앱이 번들을 받는 Metro(8230)가 MCP config 없이 떠 있거나, 예전 캐시로 번들을 주고 있을 가능성이 큼.**
- 해결: 8230 사용 중인 Metro를 종료한 뒤, **반드시** `bun run start` 또는 `bun run start:reset`(권장)으로 **`--config ./metro.config.js` 가 들어간 스크립트**로 Metro를 다시 띄우고, 앱을 다시 로드해서 새 번들을 받게 하면 됨.

---

## **REACT_NATIVE_MCP** 등 확인 방법

### 앱 로드 시 (연결 여부와 무관)

- **Metro / React Native 디버거 콘솔**에 다음이 한 번 찍히면 런타임이 번들에 들어가고 실행된 것이다.
  `[MCP] runtime loaded, __REACT_NATIVE_MCP__ available`
- 이 로그가 **전혀 없으면** → 진입점이 MCP transformer를 타지 않았거나, 캐시/설정 문제로 런타임이 주입되지 않은 것.

### 연결된 뒤 (evaluate_script 사용 가능할 때)

- Cursor에서 MCP 도구 `evaluate_script` 호출:
  - `() => typeof global.__REACT_NATIVE_MCP__ !== 'undefined'`
    → `true` 면 전역이 존재.
  - `() => (global.__REACT_NATIVE_MCP__ && Object.keys(global.__REACT_NATIVE_MCP__)) || []`
    → 사용 가능한 메서드 이름 목록(예: `registerComponent`, `triggerPress`, `getClickables` 등) 확인.

### 연결 안 될 때 런타임 주입 여부만 확인

- Metro로 번들 한 번 생성한 뒤, 생성된 JS 번들 파일 내용에서 다음 문자열 검색:
  - `@ohah/react-native-mcp-server/runtime` (또는 런타임 require 경로)
  - `ws://localhost:12300`
  - `__REACT_NATIVE_MCP__`
- 하나라도 없으면 해당 진입점이 MCP transformer를 타지 않은 것.

---

## 제대로 동작하는지 확인하는 절차

1. **MCP 서버는 한 군데만**
   - 터미널에서 `npx @ohah/react-native-mcp-server` 등을 따로 실행하지 말 것.
   - Cursor에서만 MCP 사용하거나, 터미널에서만 사용할 것. 둘 다 켜지 않게.

2. **12300 포트 정리 후 앱·Metro만 실행**
   - `kill $(lsof -t -i :12300)` 실행 (이미 사용 중인 MCP 프로세스 정리).
   - `examples/demo-app`에서 Metro 실행: `bun run start` (또는 `start:reset`).
   - iOS 시뮬레이터에서 demo 앱 실행 후 앱 화면이 떴는지 확인.

3. **Cursor MCP 로그 확인**
   - Cursor 설정 → MCP 또는 출력 패널에서 `react-native-mcp` 서버 로그 확인.
   - 다음이 **한 번** 찍혀 있어야 함: `WebSocket server listening on ws://localhost:12300`.
   - `EADDRINUSE` 가 찍혀 있으면 1번으로 돌아가서 MCP 서버를 한 개만 두고, 2번부터 다시.

4. **MCP 도구로 연결 여부 확인**
   - Cursor에서 MCP 도구 호출:
     - `list_clickables` → 클릭 가능한 요소 목록(uid, label)이 나오면 **연결된 상태**.
     - `evaluate_script` → 예: 함수 `() => 1 + 2` → 결과 `3` 이 나오면 **연결된 상태**.
   - "No React Native app connected" 가 나오면 연결 안 된 것. 위 1~3과 [원인 2](#원인-2-서버는-1개인데도-앱-연결을-감지-못함-1프로세스) 항목 재확인.

5. **동작 확인 (선택)**
   - `click_by_label` 에 라벨(예: `"No test ID"`) 넣어서 호출 → 앱에서 해당 버튼이 눌린 것처럼 동작하면 정상.
   - `get_debugger_status` → devices 목록에 디바이스가 보이면 앱이 연결·init을 보낸 상태.
