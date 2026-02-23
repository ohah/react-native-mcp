# @ohah/react-native-mcp-server

React Native 앱 자동화 및 모니터링을 위한 MCP(Model Context Protocol) 서버. Cursor, Claude Desktop, GitHub Copilot CLI에서 WebSocket으로 앱을 조회·제어할 수 있습니다.

## 기능

- 앱 상태, 네트워크 요청, 콘솔 로그 모니터링
- idb(iOS) / adb(Android)로 탭, 스와이프, 텍스트 입력, 스크린샷
- 컴포넌트 트리 조회, 앱 컨텍스트에서 스크립트 실행
- `init` 한 번에 설정

## 설치

**필요 환경:** Node.js 18+ 또는 Bun. 탭/스와이프/스크린샷을 쓰려면 [idb](https://fbidb.io/) (iOS, macOS), [adb](https://developer.android.com/tools/adb) (Android)가 필요합니다.

전역 설치 없이 npx로 실행:

```bash
npx -y @ohah/react-native-mcp-server init
```

프로젝트(React Native/Expo, 패키지 매니저)를 감지하고, MCP 클라이언트(Cursor, Claude 등)를 묻고, Babel + MCP 설정 + .gitignore를 구성합니다.

전역 설치:

```bash
npm install -g @ohah/react-native-mcp-server
```

## 빠른 시작

1. **설정** (프로젝트당 한 번):

   ```bash
   npx -y @ohah/react-native-mcp-server init
   ```

2. **앱 실행.** 개발 모드에서는 MCP 런타임이 자동으로 포함됩니다 (별도 env 불필요). 예:

   ```bash
   npx react-native start
   # 또는 Expo: npx expo start
   ```

   릴리즈 빌드에서 MCP를 쓰려면 Metro를 `REACT_NATIVE_MCP_ENABLED=true`로 실행하거나 빌드 설정에 넣으세요.

3. **MCP 클라이언트 설정** (예: Cursor → 설정 → MCP). init이 설정을 만들어 줍니다. 일반적인 항목:

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

4. 앱과 Cursor(또는 Claude/Copilot)를 열면 서버가 앱에 자동 연결됩니다.

## Init 옵션

```bash
npx -y @ohah/react-native-mcp-server init -y                    # 비인터랙티브 (Cursor 기본)
npx -y @ohah/react-native-mcp-server init --client cursor       # Cursor
npx -y @ohah/react-native-mcp-server init --client claude-code  # Claude Code (CLI)
npx -y @ohah/react-native-mcp-server init --client claude-desktop
npx -y @ohah/react-native-mcp-server init --help
```

## Babel 수동 설정

`init`을 쓰지 않으려면, 앱이 MCP 서버에 연결되도록 Babel 프리셋을 직접 추가하세요:

```js
// babel.config.js
module.exports = {
  presets: [
    'module:@react-native/babel-preset', // 또는 기존 프리셋
    '@ohah/react-native-mcp-server/babel-preset',
  ],
};
```

### Babel 프리셋 옵션

프리셋을 배열로 넣고 두 번째 요소에 옵션 객체를 줄 수 있습니다.

| 옵션              | 타입                                                    | 기본값  | 설명                                                                  |
| ----------------- | ------------------------------------------------------- | ------- | --------------------------------------------------------------------- |
| `renderHighlight` | `boolean` 또는 `{ style: 'react-scan' \| 'react-mcp' }` | `false` | 앱 로드 시 렌더 하이라이트 켜기. `true` = 스타일 `'react-mcp'`(기본). |

- **`true`** — 켜기, 스타일 `'react-mcp'` (시안 #61dafb, 기본, DevTools 아이콘 톤).
- **`{ style: 'react-mcp' }`** — `true`와 동일.
- **`{ style: 'react-scan' }`** — 보라색, react-scan 스타일.

예:

```js
presets: [
  'module:@react-native/babel-preset',
  ['@ohah/react-native-mcp-server/babel-preset', { renderHighlight: true }],
  // 또는: { renderHighlight: { style: 'react-scan' } }  로 보라색
],
```

그 다음 Quick Start 3단계처럼 MCP 클라이언트 설정(예: `.cursor/mcp.json` 또는 Claude 설정)에 서버 항목을 추가하세요.

## 네이티브 도구 (idb / adb)

탭, 스와이프, 스크린샷 등에는 다음이 필요합니다:

| 플랫폼         | 도구 | 설치                                                                              |
| -------------- | ---- | --------------------------------------------------------------------------------- |
| iOS 시뮬레이터 | idb  | `brew tap facebook/fb && brew install idb-companion` (macOS)                      |
| Android        | adb  | Android Studio 설치(adb 포함), 또는 `brew install android-platform-tools` (macOS) |

이것들이 없어도 상태, 네트워크, 콘솔, eval 등 다른 MCP 도구는 동작합니다.

## 문서

- **전체 문서:** [react-native-mcp.dev](https://react-native-mcp.dev) ([영문](https://react-native-mcp.dev/en/mcp/getting-started) / [한국어](https://react-native-mcp.dev/ko/mcp/getting-started))
- **VS Code 확장:** [마켓플레이스](https://marketplace.visualstudio.com/items?itemName=ohah.react-native-mcp-devtools)에서 설치 또는 `Ctrl+Shift+X` → **React Native MCP DevTools** 검색. [문서](https://react-native-mcp.dev/ko/mcp/vscode-extension) ([en](https://react-native-mcp.dev/en/mcp/vscode-extension))
- **도구 레퍼런스:** [MCP 도구 전체](https://react-native-mcp.dev/ko/mcp/tools/) · **E2E 테스팅:** [YAML 시나리오](https://react-native-mcp.dev/ko/test/)
- **저장소:** [github.com/ohah/react-native-mcp](https://github.com/ohah/react-native-mcp)

## 라이선스

MIT
