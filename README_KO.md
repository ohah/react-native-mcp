# React Native MCP Server

React Native 앱 자동화 및 모니터링을 위한 MCP(Model Context Protocol) 서버. Cursor, Claude Desktop, GitHub Copilot CLI에서 사용할 수 있습니다.

## 기능

- 🔍 React Native 앱 상태 모니터링
- 📡 네트워크 요청 추적
- 📝 콘솔 로그 수집
- 🤖 AI 기반 디버깅 및 자동화

## 설치

```bash
npm install -g @ohah/react-native-mcp-server
```

`npx`를 사용하면 설치 없이 바로 사용할 수 있습니다.

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
4. React Native 앱에 Metro 플러그인 추가:

```js
// metro.config.mjs (ESM 구성 파일)
import { withReactNativeMCP } from '@ohah/react-native-mcp-server/metro-plugin';

export default withReactNativeMCP({
  // 기존 Metro 설정
});
```

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

## 개발

- **도구**: [mise](https://mise.jdx.dev/) (`.mise.toml` 참고), oxlint/oxfmt (린트/포맷)
- **스크립트**:
  - `bun run build` - 서버 빌드
  - `bun run mcp` - MCP 서버 실행
  - `bun run dev` - Watch 모드
  - `bun run test` - 테스트 실행

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
