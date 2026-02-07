# MCP 명령을 사용자 환경에 맞게 설정

MCP 서버는 `mise` 경로를 `command`로 씁니다. Cursor는 PATH를 거의 비운 채로 MCP를 실행해서, **각 사용자가 자신의 mise 경로**로 `.cursor/mcp.json`을 한 번 갱신해야 합니다.

## 할 일

**저장소 루트에서** 아래 명령을 실행하세요:

```bash
bun run setup-mcp
```

또는:

```bash
bun run .cursor/scripts/set-mcp-mise-path.ts
```

- `mise`가 PATH에 있으면 그 경로를 찾아 `.cursor/mcp.json`의 MCP 서버 `command`를 해당 경로로 덮어씁니다.
- `mise`가 PATH에 없으면 `~/.local/bin/mise`, `/opt/homebrew/bin/mise` 등 흔한 설치 위치를 찾아 씁니다.
- 실행 후 Cursor를 한 번 재시작하면 MCP가 새 경로로 동작합니다.

## /setup-mcp 실행 시

에이전트가 위 `bun run setup-mcp`를 실행해 사용자 환경에 맞게 `.cursor/mcp.json`을 갱신합니다.
