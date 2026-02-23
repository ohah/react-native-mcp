# React Native MCP Server

[![npm](https://img.shields.io/npm/v/@ohah/react-native-mcp-server)](https://www.npmjs.com/package/@ohah/react-native-mcp-server)
[![license](https://img.shields.io/npm/l/@ohah/react-native-mcp-server)](./LICENSE)

> [English](./README.md) | [문서 사이트](https://ohah.github.io/react-native-mcp/)

React Native 앱 자동화 및 모니터링을 위한 MCP(Model Context Protocol) 서버. Cursor, Claude Desktop, Claude Code, GitHub Copilot, Windsurf 등 모든 MCP 호환 클라이언트에서 사용할 수 있습니다.

## 이 프로젝트가 다른 점

- **React Fiber 트리 접근** — 스크린샷이나 접근성 라벨이 아닌, 실제 Fiber 트리로 컴포넌트를 쿼리하고 검사
- **상태 인스펙션** — 어떤 컴포넌트든 React 훅(useState, Zustand 등)을 실시간으로 확인
- **렌더 프로파일링** — React DevTools 없이 마운트, 리렌더, 불필요한 렌더를 추적
- **네트워크 모킹** — XHR/fetch를 인터셉트하고 모의 응답을 런타임에 주입
- **48개 MCP 도구** — 탭, 스와이프, 스크린샷, 검증, eval 등 12개 카테고리
- **Zero Native Module** — 순수 JS 런타임 + 호스트 CLI 도구(adb/idb). 링킹 불필요, 네이티브 코드 없음
- **YAML E2E 테스팅** — YAML로 시나리오를 작성하고 CI에서 AI 없이 실행

## 문서

| 가이드                                                                          | 설명                                              |
| ------------------------------------------------------------------------------- | ------------------------------------------------- |
| [시작하기](https://ohah.github.io/react-native-mcp/ko/mcp/getting-started)      | 5분 설정 가이드                                   |
| [Expo 가이드](https://ohah.github.io/react-native-mcp/ko/mcp/expo-guide)        | Expo 전용 설정 (Dev Client, Expo Go, Expo Router) |
| [도구 레퍼런스](https://ohah.github.io/react-native-mcp/ko/mcp/tools/)          | 48개 도구의 파라미터와 예제                       |
| [쿡북](https://ohah.github.io/react-native-mcp/ko/mcp/cookbook/)                | 실전 활용 시나리오                                |
| [아키텍처](https://ohah.github.io/react-native-mcp/ko/mcp/architecture)         | 내부 동작 원리                                    |
| [문제 해결](https://ohah.github.io/react-native-mcp/ko/mcp/troubleshooting)     | 연결 문제와 해결 방법                             |
| [VS Code 확장](https://ohah.github.io/react-native-mcp/ko/mcp/vscode-extension) | 사이드바에서 DevTools + 컴포넌트 트리             |
| [E2E 테스팅](https://ohah.github.io/react-native-mcp/ko/test/)                  | YAML 시나리오 테스팅                              |

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

**Step 4 — 앱 실행 후 MCP 도구 사용**

```bash
# Bare RN
npx react-native start

# Expo
npx expo start
```

### 옵션

```bash
# 비인터랙티브 모드 — 프롬프트 생략, Cursor 기본
npx -y @ohah/react-native-mcp-server init -y

# 클라이언트 직접 지정
npx -y @ohah/react-native-mcp-server init --client cursor
npx -y @ohah/react-native-mcp-server init --client claude-code

# 도움말
npx -y @ohah/react-native-mcp-server init --help
```

`init`을 여러 번 실행해도 안전합니다 — 각 단계에서 이미 적용된 변경은 건너뜁니다.

## 사용법

### Cursor

`.cursor/mcp.json`에 추가:

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

### Claude Desktop / Claude Code

```bash
# Claude Code CLI (권장)
claude mcp add --transport stdio react-native-mcp -- npx -y @ohah/react-native-mcp-server
```

또는 `~/Library/Application Support/Claude/claude_desktop_config.json`에 동일한 JSON 구조로 추가.

### GitHub Copilot CLI

Copilot CLI에서 `/mcp add react-native-mcp` 실행, 또는 `~/.copilot/mcp-config.json` 편집.

### VS Code 확장 (DevTools)

[**React Native MCP DevTools**](https://marketplace.visualstudio.com/items?itemName=ohah.react-native-mcp-devtools)를 마켓플레이스에서 설치하거나, VS Code에서 `Ctrl+Shift+X`(확장) → **React Native MCP DevTools** 검색 → 설치. 사이드바에서 Console, Network, State, Renders, Component Tree를 사용할 수 있습니다. .vsix 로컬 설치는 [VS Code 확장](https://ohah.github.io/react-native-mcp/ko/mcp/vscode-extension) 문서를 참고하세요.

> 클라이언트별 상세 설정은 [Cursor / Claude / Copilot](https://ohah.github.io/react-native-mcp/ko/mcp/mcp-usage)를 참고하세요.

## 필수: 네이티브 도구 (idb / adb)

MCP 서버는 네이티브 터치 주입과 스크린샷을 위해 **idb**(iOS) / **adb**(Android)를 사용합니다.

```bash
# Android
brew install --cask android-platform-tools  # 또는 Android Studio 설치
adb devices  # 확인

# iOS 시뮬레이터
brew tap facebook/fb && brew install idb-companion
pip3 install fb-idb
idb list-targets  # 확인
```

> idb는 macOS 전용, 시뮬레이터만 지원. 자세한 내용은 [idb 설치 가이드](./docs/references/idb-setup.md) 참고.

## 아키텍처

```
React Native 앱 (iOS/Android)
  ↓ (WebSocket)
  └─ Runtime (Babel 프리셋으로 자동 주입)
       ↓
     MCP 서버 (개발자 PC, 포트 12300)
       ↓ (stdio/MCP protocol)
     Cursor / Claude Desktop / Copilot CLI
```

전체 설계는 [아키텍처](https://ohah.github.io/react-native-mcp/ko/mcp/architecture)를 참고하세요.

## 개발

- **도구**: [mise](https://mise.jdx.dev/) (`.mise.toml` 참고), oxlint/oxfmt (린트/포맷)
- **스크립트**:
  - `bun run build` - 서버 빌드
  - `bun run mcp` - MCP 서버 실행
  - `bun run dev` - Watch 모드
  - `bun run test` - 테스트 실행
  - `bun run test:mcp` - 서버 실행 후 stdio로 `evaluate_script` 호출

## 라이선스

MIT © [ohah](https://github.com/ohah)
