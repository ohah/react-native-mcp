# 설치 및 연결

React Native MCP를 사용하려면 **MCP 서버**, **클라이언트 설정**, **앱 쪽 설정**, **네이티브 도구(idb/adb)** 가 필요합니다.

## 1. MCP 서버 설치

전역 설치:

```bash
npm install -g @ohah/react-native-mcp-server
```

설치 없이 실행만 하려면:

```bash
npx -y @ohah/react-native-mcp-server
```

Cursor·Claude·Copilot 설정에서는 보통 `npx`로 실행하는 방식을 사용합니다.

## 2. 클라이언트에 서버 등록

사용하는 AI 클라이언트에 MCP 서버를 등록해야 합니다.

- **Cursor**: [MCP 사용법 - Cursor](./mcp-usage#cursor) 참고
- **Claude Desktop**: [MCP 사용법 - Claude Desktop](./mcp-usage#claude-desktop) 참고
- **GitHub Copilot CLI**: [MCP 사용법 - Copilot CLI](./mcp-usage#github-copilot-cli) 참고

## 3. React Native 앱 설정

MCP 서버가 앱과 통신하려면 Metro에서 **cdp-interceptor**를 로드하고, **Babel 프리셋**을 적용해야 합니다.

### Metro — cdp-interceptor

`metro.config.js` **맨 위**에서 인터셉터를 require한 뒤 기존 설정을 이어갑니다.

```js
// metro.config.js
require('@ohah/react-native-mcp-server/cdp-interceptor');

const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
module.exports = mergeConfig(getDefaultConfig(__dirname), {
  // 필요한 오버라이드
});
```

또는 Metro를 인터셉터와 함께 실행:

```bash
node -r @ohah/react-native-mcp-server/cdp-interceptor node_modules/react-native/cli.js start
```

### Babel 프리셋

`babel.config.js`에 프리셋 추가 (AppRegistry 래핑, testID 자동 주입):

```js
module.exports = {
  presets: ['module:@react-native/babel-preset', '@ohah/react-native-mcp-server/babel-preset'],
};
```

개발 빌드에서만 적용하려면:

```js
const isDev = process.env.NODE_ENV !== 'production';
const mcpPreset = isDev ? ['@ohah/react-native-mcp-server/babel-preset'] : [];
module.exports = {
  presets: ['module:@react-native/babel-preset', ...mcpPreset],
};
```

## 4. 네이티브 도구 (idb / adb)

탭·스와이프·스크린샷 등은 **idb**(iOS) / **adb**(Android)를 통해 동작합니다. 반드시 설치해야 합니다.

### Android — adb

- Android Studio에 포함되어 있음
- 별도 설치: `brew install --cask android-platform-tools` (macOS)
- 확인: `adb devices`

### iOS 시뮬레이터 — idb

[idb (iOS Development Bridge)](https://fbidb.io/) 설치:

```bash
brew tap facebook/fb && brew install idb-companion
pip3 install fb-idb
```

확인: `idb list-targets`

> idb는 macOS 전용이며 시뮬레이터만 지원합니다. 실기기는 별도 설정이 필요합니다.

## 5. 동작 확인

1. Metro로 앱 실행 (`bun run start` 또는 `npm start`)
2. iOS 시뮬레이터 또는 Android 에뮬레이터에서 앱 실행
3. Cursor(또는 사용 중인 클라이언트)에서 MCP 연결 후, 스냅샷·탭 등 도구가 동작하는지 확인

문제가 있으면 [MCP 사용법](./mcp-usage)의 트러블슈팅이나 저장소 이슈를 참고하세요.
