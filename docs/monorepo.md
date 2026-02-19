# 모노레포 구조 및 배포

이 레포는 모노레포(bun workspaces)이며, 여러 패키지가 있지만 **npm에 배포되는 패키지는 하나뿐**입니다.

## 사용자에게 필요한 패키지

일반 사용자(Cursor/Claude에서 MCP로 RN 앱 사용)는 **@ohah/react-native-mcp-server** 하나만 있으면 됩니다.

- 이 패키지만 npm에 배포됩니다.
- 다른 워크스페이스 패키지에 의존하지 않습니다 (의존성은 `@modelcontextprotocol/sdk`, `ws`, `zod`, `sharp` 등 공개 npm 패키지뿐).
- `npx -y @ohah/react-native-mcp-server init` 및 `npx -y @ohah/react-native-mcp-server` 로 사용합니다.

## 디렉터리 구조

| 경로                               | 설명                                            | npm 배포                           |
| ---------------------------------- | ----------------------------------------------- | ---------------------------------- |
| `packages/react-native-mcp-server` | MCP 서버 + CLI + 런타임 + Babel 프리셋/플러그인 | ✅ `@ohah/react-native-mcp-server` |
| `packages/react-native-mcp-client` | MCP 클라이언트 SDK (E2E 스크립트 등에서 사용)   | ❌                                 |
| `packages/react-native-mcp-test`   | YAML 기반 E2E 테스트 러너                       | ❌                                 |
| `editor/vscode`                    | VS Code 확장 (React Native MCP DevTools)        | 마켓플레이스/vsix                  |
| `examples/demo-app`                | 데모 앱 (E2E 테스트 대상)                       | ❌                                 |
| `document`                         | Rspress 문서 사이트                             | ❌                                 |

## 배포 (관리자)

서버 패키지 배포는 태그 푸시 또는 수동 워크플로로 합니다. 태그 형식, NPM_TOKEN, 절차는 [개발 명령어 — 태그로 npm 배포](development-commands.md#태그로-npm-배포-서버-패키지)를 참고하세요.
