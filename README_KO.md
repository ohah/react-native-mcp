# React Native MCP Server

React Native 앱 자동화 및 모니터링을 위한 MCP(Model Context Protocol) 서버. Cursor, Claude Desktop, GitHub Copilot CLI에서 사용할 수 있습니다.

## 기능

- 🔍 React Native 앱 상태 모니터링
- 📡 네트워크 요청 추적
- 📝 콘솔 로그 수집
- 🤖 AI 기반 디버깅 및 자동화

## 설치

**필요 환경:** Node.js 18+ 또는 Bun (예: [mise](https://mise.jdx.dev/) — 이 레포에서 `mise install`, 또는 [Node](https://nodejs.org/) / [Bun](https://bun.sh/) 전역 설치).

전역 설치 없이 **npx**로 실행:

```bash
npx -y @ohah/react-native-mcp-server
```

Cursor/Claude/Copilot에서는 MCP 설정에 `"command": "npx"`, `"args": ["-y", "@ohah/react-native-mcp-server"]` 를 넣으면 됩니다 (아래 사용법 참고).

선택: 전역 설치

```bash
npm install -g @ohah/react-native-mcp-server
```

## 사용법

### Cursor

1. **Cursor 설정** → **MCP** 이동 (또는 프로젝트의 `.cursor/mcp.json` 편집)
2. 다음 설정 추가:

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

3. Cursor 재시작 (또는 MCP 새로고침)
4. React Native 앱에서 Metro에 CDP 인터셉터 로드 + Babel 프리셋 추가.

**Metro** — `metro.config.js` **맨 위**에서 인터셉터를 require한 뒤 기존 설정:

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

**Babel** — 앱에 프리셋 추가 (AppRegistry 래핑, testID 자동 주입):

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset', '@ohah/react-native-mcp-server/babel-preset'],
};
```

**빌드별로 프리셋 적용하기**  
`babel.config.js`는 일반 JS이므로 `process.env`로 분기할 수 있습니다.

- **개발 빌드에서만 적용** (릴리즈 번들에는 미포함):

```js
const isDev = process.env.NODE_ENV !== 'production';
const mcpPreset = isDev ? ['@ohah/react-native-mcp-server/babel-preset'] : [];
module.exports = {
  presets: ['module:@react-native/babel-preset', ...mcpPreset],
};
```

- **릴리즈에서만 적용**: `isDev` 대신 `process.env.NODE_ENV === 'production'` 사용.
- **커스텀 env로 제어**: 예) `process.env.ENABLE_MCP === '1'`일 때만 프리셋 추가.

### Claude Desktop

Claude Desktop 설정 파일 편집:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

다음 내용 추가:

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

Claude Desktop 재시작.

### GitHub Copilot CLI

`/mcp` 명령어로 서버 추가:

```bash
copilot
> /mcp add react-native-mcp
```

프롬프트에서 다음 입력:

- **Command**: `npx`
- **Args**: `-y @ohah/react-native-mcp-server`

또는 `~/.copilot/mcp-config.json` 직접 편집:

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

Copilot CLI 재시작.

## 필수: 네이티브 도구 (idb / adb)

MCP 서버는 네이티브 터치 주입(`tap`, `swipe`, `input_text` 등)과 스크린샷을 위해 **idb**(iOS) / **adb**(Android)를 사용합니다. 전체 기능을 사용하려면 **설치가 필요**합니다.

### Android (adb)

adb는 Android Studio에 포함되어 있습니다. 별도 설치:

```bash
# macOS
brew install --cask android-platform-tools

# 또는 Android Studio 설치 시 ~/Library/Android/sdk/platform-tools/adb 에 위치
```

확인: `adb devices`

### iOS 시뮬레이터 (idb)

[idb (iOS Development Bridge)](https://fbidb.io/)는 iOS 시뮬레이터 자동화에 필요합니다:

```bash
brew tap facebook/fb && brew install idb-companion
pip3 install fb-idb
```

확인: `idb list-targets`

> **참고**: idb는 macOS 전용이며 시뮬레이터만 지원합니다. 실기기는 XCTest/WDA 설정이 필요합니다.

자세한 내용은 [idb 설치 가이드](./docs/idb-setup.md)를 참고하세요.

## 개발

- **도구**: [mise](https://mise.jdx.dev/) (`.mise.toml` 참고), oxlint/oxfmt (린트/포맷)
- **스크립트**:
  - `bun run build` - 서버 빌드
  - `bun run mcp` - MCP 서버 실행
  - `bun run dev` - Watch 모드
  - `bun run test` - 테스트 실행
  - `bun run test:e2e -- -p ios` / `bun run test:e2e -- -p android` - E2E YAML 테스트 (데모앱 `examples/demo-app/e2e/`). YAML 문법: [E2E YAML 레퍼런스](docs/e2e-yaml-reference.md)

## 아키텍처

```
React Native 앱 (iOS/Android)
  ↓ (WebSocket)
  └─ Runtime (Metro로 자동 주입)
       ↓
     MCP 서버 (개발자 PC)
       ↓ (stdio/MCP protocol)
     Cursor / Claude Desktop / Copilot CLI
```

## 패키지 구조

```
packages/
└── react-native-mcp-server/    # 모든 기능을 포함한 단일 패키지
    ├── src/
    │   └── index.ts            # MCP 서버 및 CLI 진입점
    ├── tests/                  # 테스트 코드
    └── package.json
```

## 라이선스

MIT © [ohah](https://github.com/ohah)
