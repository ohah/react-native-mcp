# React Native MCP — Agent Guide

MCP(Model Context Protocol) server for React Native app automation and monitoring.
48 tools across 12 categories. Pure JS runtime + host CLI (adb/idb). No native module.

---

## Quick Context

- **Monorepo**: Bun workspace, managed by [mise](https://mise.jdx.dev/) (see `.mise.toml`)
- **Main package**: `packages/react-native-mcp-server/`
- **Runtime**: `packages/react-native-mcp-server/runtime.js` — **generated** from `src/runtime/*.ts` by tsdown. Do NOT edit directly.
- **WebSocket port**: 12300 (server listens, app runtime connects)
- **Connection flow**: app runtime → `ws://localhost:12300` → sends `{type:'init'}` → server registers device
- **Server command**: Always use `node` (not `bun`) — see Bun+ws known issue below

---

## Architecture & Design

- [Overview & Features](docs/architecture/overview.md) — project overview, package structure, 48 tools
- [Design Decisions (ADR)](docs/architecture/design-decisions.md) — 8 core technical decisions and rationale
- [User-facing architecture](document/docs/en/mcp/architecture.md) — 3-layer diagram, communication flow, build pipeline

### Key Architecture Facts

1. **React Fiber tree** — no DOM; components queried via Fiber, not accessibility labels
2. **Babel preset** injects runtime at build time (testID injection + AppRegistry wrapping)
3. **Host CLI tools** for screenshots/touch (adb for Android, idb for iOS simulator) — no native module in app
4. **Multi-device**: Every tool accepts optional `deviceId` / `platform` params
5. **Hermes assumed**: `URL.origin` not available (RN ≤ 0.74), `Event` constructor absent (RN 0.72–0.83)

---

## Development

- [Development Commands](docs/guides/development-commands.md) — all scripts
- [Tech Stack](docs/guides/tech-stack.md) — Bun, tsdown, vitest, oxlint/oxfmt
- [Monorepo](docs/guides/monorepo.md) — workspace structure, publishing

### Essential Commands

```bash
bun install          # Install dependencies
bun run build        # Build server
bun run dev          # Watch mode
bun run mcp          # Run MCP server
bun run test         # Run tests
bun run test:unit    # Unit tests only
bun run test:e2e -- -p ios    # E2E tests
bun run lint         # oxlint
bun run format       # oxfmt
```

### Demo App

- Path: `examples/demo-app/`
- Metro port: **8230** (not default 8081)
- iOS bundleId: `org.reactnativemcp.demo`, Android: `com.reactnativemcp.demo`

---

## Code Guidelines

- [Coding Style](docs/guides/coding-style.md) — JSDoc for public APIs, Korean comments OK, oxlint/oxfmt
- [Behavioral Guidelines](.cursor/rules/behavioral-guidelines.mdc) — AI agent behavioral rules
- [Commit Rules](docs/guides/commit-rules.md) — Conventional Commits (`feat|fix|refactor|test|docs|chore(scope): subject`)
- [PR Rules](docs/guides/pr-rules.md) — PR process and checklist

---

## Platform References

- [ADB](docs/references/adb.md) — Android Debug Bridge commands
- [idb](docs/references/idb.md) — iOS Development Bridge commands
- [idb Setup](docs/references/idb-setup.md) — idb install, config, troubleshooting
- [XCUITest / WDA](docs/references/xcuitest-wda.md) — XCUITest and WebDriverAgent reference
- [Orientation & Coordinates](docs/references/orientation-coordinates.md) — iOS landscape coordinate transformation

---

## Specs & Comparisons

- [E2E Tool Comparison](docs/specs/e2e-comparison.md) — vs Detox, Maestro, Appium
- [VS Code Extension](docs/specs/vscode-extension.md) — extension architecture and panel design

---

## Troubleshooting

- [App Connection](docs/troubleshooting/app-connection.md) — "No app connected" diagnosis and fixes
- [E2E CI Reliability](docs/troubleshooting/e2e-ci-reliability.md) — CI stability patterns
- [CI E2E Failure Analysis](docs/troubleshooting/ci-e2e-failure-analysis.md) — failure analysis

---

## Known Issues

- **Bun + ws**: `bun`으로 MCP 서버 실행 시 `ws` 라이브러리의 `message` 이벤트 미발생 (Bun v1.3.9). 항상 `node` 사용.
- **Hermes URL.origin**: RN ≤ 0.74에서 `URL.origin` 미구현. regex fallback 사용.
- **Hermes Event constructor**: RN 0.72–0.83에서 `Event` 생성자 없음. XHR mock은 RN 내부 `__did*` 메서드 직접 호출.
- **iOS real device**: idb 터치 주입 미지원. 시뮬레이터 권장.

---

## Documentation Structure

- `docs/` — 내부 개발 문서 (이 파일이 가리키는 곳). 인덱스: [docs/README.md](docs/README.md)
- `document/docs/` — rspress 사용자 대상 문서 (en/ko). 도구 레퍼런스, 쿡북, E2E 가이드 등.
- **단일 소스 원칙**: 사용자 대상 콘텐츠는 `document/docs/`에서만 관리. `docs/`는 내부 개발용.

---

## E2E Testing

- [E2E YAML Reference](document/docs/en/testing/e2e-yaml-reference.md) — YAML scenario syntax and steps
- Runner: `packages/react-native-mcp-server/src/e2e/`
- Config: `e2e.yaml` at project root
