# Expo 가이드

React Native MCP는 Expo 프로젝트에서도 동작합니다. runtime.js는 순수 JS이며, Expo도 동일한 Hermes 런타임을 사용합니다.

> **빠른 설정**: `npx -y @ohah/react-native-mcp-server init` 명령어로 Expo 프로젝트를 자동 감지하여 Babel 프리셋 추가 + MCP 클라이언트 설정을 한번에 완료할 수 있습니다.

---

## 호환성

| 환경                                            | 지원  | 비고                                           |
| ----------------------------------------------- | ----- | ---------------------------------------------- |
| Expo Dev Client (`npx expo start --dev-client`) | **O** | bare RN과 동일하게 동작                        |
| Expo Go                                         | **△** | localhost WebSocket 연결 제한 가능 (아래 참고) |
| EAS Build (development)                         | **O** | Dev Client와 동일                              |
| EAS Build (production)                          | **—** | `__DEV__` false — MCP 런타임 비활성화          |

### 왜 동작하는가

- `runtime.js`는 순수 JavaScript — Expo도 동일한 Hermes 런타임 사용
- `__REACT_DEVTOOLS_GLOBAL_HOOK__`은 React 표준 — Expo에서도 동일
- WebSocket은 RN 내장 — Expo에서도 동일
- `require('react-native')` 는 Expo에서도 동일하게 동작

---

## 설치

### 1. 패키지 설치

```bash
npx expo install @ohah/react-native-mcp-server
```

> `npx expo install`은 Expo SDK 버전에 맞는 호환 버전을 자동으로 설치합니다. `npm install`도 동작하지만 `npx expo install`을 권장합니다.

### 2. Babel 프리셋 추가

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo', '@ohah/react-native-mcp-server/babel-preset'],
  };
};
```

> Expo 프로젝트는 `babel-preset-expo`를 사용합니다 (`module:@react-native/babel-preset` 아님).

개발 빌드에서만 적용하려면:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    presets: [
      'babel-preset-expo',
      ...(isDev ? ['@ohah/react-native-mcp-server/babel-preset'] : []),
    ],
  };
};
```

### 3. MCP 런타임 활성화

프로젝트 구조에 따라 진입점이 다릅니다.

#### Expo Router 프로젝트 (`app/` 디렉토리)

`app/_layout.tsx`에서 활성화:

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

if (__DEV__) {
  // @ts-ignore — babel-preset이 전역에 주입
  global.__REACT_NATIVE_MCP__?.enable();
}

export default function RootLayout() {
  return <Stack />;
}
```

#### 기존 구조 (`App.tsx` / `index.js`)

`index.js` 또는 `App.tsx` 상단에서 활성화:

```js
// index.js (또는 App.tsx)
import { registerRootComponent } from 'expo';
import App from './App';

global.__REACT_NATIVE_MCP__?.enable();

registerRootComponent(App);
```

> `__REACT_NATIVE_MCP__`는 Babel 프리셋이 주입하는 전역 객체입니다. 프리셋 없이는 `undefined`이므로 옵셔널 체이닝(`?.`)으로 안전하게 호출합니다.

### 4. MCP 서버 설정

MCP 클라이언트(Cursor, Claude Desktop 등)에 서버를 등록합니다. 기존 bare RN 프로젝트와 동일합니다.

```json
{
  "mcpServers": {
    "react-native-mcp": {
      "command": "npx",
      "args": ["-y", "@ohah/react-native-mcp-server"]
    }
  }
}
```

### 5. 앱 실행

```bash
# Dev Client (권장)
npx expo start --dev-client

# 또는 Expo Go (제한 있음 — 아래 참고)
npx expo start
```

---

## Expo Go 제한 사항

Expo Go는 사전 빌드된 샌드박스 앱입니다. 다음 제한이 있습니다:

1. **localhost WebSocket 연결**: Expo Go는 자체 네트워크 샌드박스에서 실행되므로, `ws://localhost:12300` 연결이 실패할 수 있습니다.
   - iOS 시뮬레이터: localhost가 호스트 머신을 가리키므로 **동작 가능**
   - Android 에뮬레이터: `adb reverse tcp:12300 tcp:12300` 필요
   - 실기기: localhost 대신 호스트 IP를 사용해야 하며, Expo Go에서는 설정 변경이 불가능할 수 있음

2. **커스텀 네이티브 모듈 불가**: Expo Go는 미리 포함된 네이티브 모듈만 사용 가능. 하지만 react-native-mcp는 순수 JS이므로 이 제한에 해당하지 않음.

3. **Babel 프리셋**: Expo Go에서도 Babel 프리셋은 정상 적용됨 (Metro 빌드 시점에 처리).

**권장**: 안정적인 개발 경험을 위해 **Expo Dev Client**를 사용하세요.

```bash
# Dev Client 빌드 생성
npx expo run:ios    # 또는 npx expo run:android
# 이후 Dev Client로 실행
npx expo start --dev-client
```

---

## 트러블슈팅

### MCP 연결이 안 될 때

1. MCP 서버가 실행 중인지 확인 (포트 12300)
2. `__REACT_NATIVE_MCP__?.enable()` 호출이 되는지 확인 — `console.log(typeof __REACT_NATIVE_MCP__)` 로 체크
3. Babel 프리셋이 적용되었는지 확인 — Metro 캐시 초기화 후 재시작:
   ```bash
   npx expo start --clear
   ```
4. Android 에뮬레이터에서는 포트 포워딩 필요:
   ```bash
   adb reverse tcp:12300 tcp:12300
   ```

### `__REACT_NATIVE_MCP__`가 undefined일 때

Babel 프리셋이 적용되지 않은 상태입니다.

1. `babel.config.js`에 `@ohah/react-native-mcp-server/babel-preset`이 추가되어 있는지 확인
2. Metro 캐시 초기화: `npx expo start --clear`
3. 패키지가 설치되어 있는지 확인: `npx expo install @ohah/react-native-mcp-server`

### Expo Go에서 WebSocket 연결 실패

시뮬레이터/에뮬레이터가 아닌 실기기에서 Expo Go를 사용하는 경우 localhost 연결이 불가능합니다. Dev Client로 전환하거나, 실기기 환경에서는 호스트 머신의 IP를 사용해야 합니다.

기타 연결 문제는 [문제 해결](./troubleshooting) 페이지를 참고하세요.
