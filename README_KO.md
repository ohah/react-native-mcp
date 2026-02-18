# React Native MCP Server

React Native 앱 자동화 및 모니터링을 위한 MCP(Model Context Protocol) 서버. Cursor, Claude Desktop, GitHub Copilot CLI에서 사용할 수 있습니다.

## 기능

- 🔍 React Native 앱 상태 모니터링
- 📡 네트워크 요청 추적
- 📝 콘솔 로그 수집
- 🤖 AI 기반 디버깅 및 자동화

## 빠른 시작 (CLI init)

프로젝트에 React Native MCP를 설정하는 가장 빠른 방법:

```bash
npx -y @ohah/react-native-mcp-server init
```

### 동작 과정

init 명령어는 다음 단계를 순서대로 실행합니다:

**Step 1 — 프로젝트 감지** (자동)

`package.json`, lock 파일, 설정 파일을 읽어 다음을 감지:

- React Native 버전 (`dependencies.react-native`)
- Expo 여부 (`dependencies.expo`, `app.json`, `app.config.ts`)
- Babel 설정 위치 (`babel.config.js`, `.babelrc` 등)
- 패키지 매니저 (`bun.lock` → bun, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, 그 외 npm)

```
 Detecting project...
  ✓ React Native 0.83.1
  ✓ Expo detected (expo@~52.0.0)
  ✓ Package manager: bun
```

**Step 2 — MCP 클라이언트 선택** (인터랙티브 프롬프트)

사용 중인 MCP 클라이언트를 선택합니다. 설정 파일 생성 위치가 결정됩니다.

```
? Which MCP client do you use?
  1. Cursor
  2. Claude Code (CLI)
  3. Claude Desktop
  4. Windsurf
  5. Antigravity
> 1
```

| 클라이언트     | 설정 경로                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| Cursor         | `{project}/.cursor/mcp.json`                                              |
| Claude Code    | `claude mcp add` CLI 명령어 실행                                          |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| Windsurf       | `~/.codeium/windsurf/mcp_config.json`                                     |
| Antigravity    | `~/.gemini/antigravity/mcp_config.json`                                   |

**Step 3 — 변경 적용** (자동)

1. **babel.config.js** — `presets` 배열에 `@ohah/react-native-mcp-server/babel-preset` 추가. 이미 있으면 건너뜀.
2. **MCP 설정** — 클라이언트 설정 파일에 서버 항목 생성/병합. 기존 설정은 유지.
3. **.gitignore** — `/results/`가 없으면 추가.

```
 Applying changes...
  ✓ babel.config.js — preset added
  ✓ MCP config — created .cursor/mcp.json
  ✓ .gitignore — updated
```

**Step 4 — 다음 단계 안내**

설정 완료 후 해야 할 일을 안내합니다:

```
 Done! Next steps:
  1. Start your app: npx expo start           # Expo
     Start Metro: REACT_NATIVE_MCP_ENABLED=true npx react-native start  # bare RN
  2. Open Cursor — MCP tools are ready to use
```

### 옵션

```bash
# 비인터랙티브 모드 — 프롬프트 생략, Cursor 기본
npx -y @ohah/react-native-mcp-server init -y

# 클라이언트 직접 지정 (프롬프트 없음)
npx -y @ohah/react-native-mcp-server init --client cursor
npx -y @ohah/react-native-mcp-server init --client claude-code
npx -y @ohah/react-native-mcp-server init --client claude-desktop
npx -y @ohah/react-native-mcp-server init --client windsurf
npx -y @ohah/react-native-mcp-server init --client antigravity

# CI — 둘 다 조합
npx -y @ohah/react-native-mcp-server init --client cursor -y

# 도움말
npx -y @ohah/react-native-mcp-server init --help
```

### 멱등성

`init`을 여러 번 실행해도 안전합니다. 각 단계에서 이미 적용된 변경은 건너뜁니다:

```
  ✓ babel.config.js — preset already configured
  ✓ MCP config — already configured
  ✓ .gitignore — already has results/
```

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
4. React Native 앱에 Babel 프리셋 추가 후 MCP 런타임을 활성화한다. 콘솔/네트워크 도구는 Metro를 평소처럼 실행하면 된다 (MCP 서버가 Metro 디버거 엔드포인트에 연결하며, Metro 설정 변경은 필요 없다).

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

**MCP 런타임 활성화** — Metro를 아래 환경변수와 함께 실행하면 앱 코드 수정 없이 연결됨.

```bash
REACT_NATIVE_MCP_ENABLED=true npx react-native start
```

`true` 또는 `1`이면 활성화. **미설정 시** Metro transformer와 Babel 프리셋이 MCP 변환을 하지 않아 번들에 MCP 코드가 포함되지 않는다. `__DEV__`(개발 모드)에서는 env 설정 시 자동 연결된다.

> **Expo?** Expo 프로젝트 설정은 [Expo 검증 가이드](./docs/expo-guide.md) 참고 (babel-preset-expo, Expo Router `app/_layout.tsx`, Dev Client vs Expo Go).

### Expo

React Native MCP는 Expo 프로젝트를 지원합니다. CLI init 명령어(`npx -y @ohah/react-native-mcp-server init`)가 Expo를 자동 감지하여 설정합니다.

Expo 상세 설정(babel-preset-expo, Expo Router, Dev Client vs Expo Go)은 [Expo 검증 가이드](./docs/expo-guide.md)를 참고하세요.

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
