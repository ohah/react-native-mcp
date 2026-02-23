# React Native MCP Server

[![npm](https://img.shields.io/npm/v/@ohah/react-native-mcp-server)](https://www.npmjs.com/package/@ohah/react-native-mcp-server)
[![license](https://img.shields.io/npm/l/@ohah/react-native-mcp-server)](./LICENSE)

> [한국어 문서](./README_KO.md) | [Documentation Site](https://react-native-mcp.dev)

MCP(Model Context Protocol) server for React Native app automation and monitoring. Works with Cursor, Claude Desktop, Claude Code, GitHub Copilot, Windsurf, and any MCP-compatible client.

## What makes this different

- **React Fiber tree access** — Query and inspect components via the actual Fiber tree, not screenshots or accessibility labels
- **State inspection** — Read React hooks (useState, Zustand, etc.) of any component in real time
- **Render profiling** — Track mounts, re-renders, and unnecessary renders without React DevTools
- **Network mocking** — Intercept XHR/fetch and inject mock responses at runtime
- **38 MCP tools** — Tap, swipe, screenshot, assert, eval, clear(target), and more across 12 categories
- **Zero native module** — Pure JS runtime + host CLI tools (adb/idb). No linking, no native code
- **YAML E2E testing** — Write scenarios in YAML and run in CI without AI

## Documentation

| Guide                                                                     | Description                                            |
| ------------------------------------------------------------------------- | ------------------------------------------------------ |
| [Quick Start](https://react-native-mcp.dev/en/mcp/getting-started)        | 5-minute setup guide                                   |
| [Expo Guide](https://react-native-mcp.dev/en/mcp/expo-guide)              | Expo-specific setup (Dev Client, Expo Go, Expo Router) |
| [Tool Reference](https://react-native-mcp.dev/en/mcp/tools/)              | All 42 tools with parameters and examples              |
| [Cookbook](https://react-native-mcp.dev/en/mcp/cookbook/)                 | Real-world usage scenarios                             |
| [Architecture](https://react-native-mcp.dev/en/mcp/architecture)          | How it works under the hood                            |
| [Troubleshooting](https://react-native-mcp.dev/en/mcp/troubleshooting)    | Connection issues and fixes                            |
| [VS Code Extension](https://react-native-mcp.dev/en/mcp/vscode-extension) | DevTools + Component Tree in the sidebar               |
| [E2E Testing](https://react-native-mcp.dev/en/test/)                      | YAML scenario testing                                  |

## Quick Start (CLI init)

The fastest way to set up React Native MCP in your project:

```bash
npx -y @ohah/react-native-mcp-server init
```

### What it does

The init command runs through these steps:

**Step 1 — Project Detection** (automatic)

Reads `package.json`, lock files, and config files to detect:

- React Native version (`dependencies.react-native`)
- Expo (`dependencies.expo`, `app.json`, `app.config.ts`)
- Babel config location (`babel.config.js`, `.babelrc`, etc.)
- Package manager (`bun.lock` → bun, `yarn.lock` → yarn, `pnpm-lock.yaml` → pnpm, otherwise npm)

```
 Detecting project...
  ✓ React Native 0.83.1
  ✓ Expo detected (expo@~52.0.0)
  ✓ Package manager: bun
```

**Step 2 — MCP Client Selection** (interactive prompt)

Asks which MCP client you use. This determines where the server config file is created.

```
? Which MCP client do you use?
  1. Cursor
  2. Claude Code (CLI)
  3. Claude Desktop
  4. Windsurf
  5. Antigravity
> 1
```

| Client         | Config location                                                           |
| -------------- | ------------------------------------------------------------------------- |
| Cursor         | `{project}/.cursor/mcp.json`                                              |
| Claude Code    | `claude mcp add` CLI command                                              |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| Windsurf       | `~/.codeium/windsurf/mcp_config.json`                                     |
| Antigravity    | `~/.gemini/antigravity/mcp_config.json`                                   |

**Step 3 — Apply Changes** (automatic)

1. **babel.config.js** — Appends `@ohah/react-native-mcp-server/babel-preset` to the `presets` array. Skipped if already present.
2. **MCP config** — Creates or merges the server entry into the client config file. Existing settings are preserved.
3. **.gitignore** — Appends `/results/` if not already present.

**Step 4 — Run your app and start using MCP tools**

```bash
# Bare RN
npx react-native start

# Expo
npx expo start
```

### Options

```bash
# Non-interactive mode — skip prompts, use Cursor as default client
npx -y @ohah/react-native-mcp-server init -y

# Specify client explicitly
npx -y @ohah/react-native-mcp-server init --client cursor
npx -y @ohah/react-native-mcp-server init --client claude-code

# Help
npx -y @ohah/react-native-mcp-server init --help
```

Running `init` multiple times is safe — each step checks if the change is already applied.

## Usage

### Cursor

Add to `.cursor/mcp.json`:

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
# Claude Code CLI (recommended)
claude mcp add --transport stdio react-native-mcp -- npx -y @ohah/react-native-mcp-server
```

Or edit `~/Library/Application Support/Claude/claude_desktop_config.json` with the same JSON structure.

### GitHub Copilot CLI

Run `/mcp add react-native-mcp` in Copilot CLI, or edit `~/.copilot/mcp-config.json`.

### VS Code Extension (DevTools)

Install [**React Native MCP DevTools**](https://marketplace.visualstudio.com/items?itemName=ohah.react-native-mcp-devtools) from the Marketplace, or in VS Code: `Ctrl+Shift+X` (Extensions) → search **React Native MCP DevTools** → Install. Gives you Console, Network, State, Renders, and Component Tree in the sidebar. See [VS Code Extension](https://react-native-mcp.dev/en/mcp/vscode-extension) for local .vsix install.

> For detailed client setup, see [Cursor / Claude / Copilot](https://react-native-mcp.dev/en/mcp/mcp-usage).

## Required: Native Tools (idb / adb)

The MCP server uses **idb** (iOS) and **adb** (Android) for native touch injection and screenshots.

```bash
# Android
brew install --cask android-platform-tools  # or install Android Studio
adb devices  # verify

# iOS Simulator
brew tap facebook/fb && brew install idb-companion
pip3 install fb-idb
idb list-targets  # verify
```

> idb is macOS-only, simulators only. See [idb Setup Guide](./docs/idb-setup.md) for details.

## Architecture

```
React Native App (iOS/Android)
  ↓ (WebSocket)
  └─ Runtime (auto-injected via Babel preset)
       ↓
     MCP Server (developer's machine, port 12300)
       ↓ (stdio/MCP protocol)
     Cursor / Claude Desktop / Copilot CLI
```

See [Architecture](https://react-native-mcp.dev/en/mcp/architecture) for the full design.

## Development

- **Tools**: [mise](https://mise.jdx.dev/) (see `.mise.toml`), oxlint/oxfmt for linting/formatting
- **Scripts**:
  - `bun run build` - Build the server
  - `bun run mcp` - Run MCP server
  - `bun run dev` - Watch mode
  - `bun run test` - Run tests
  - `bun run test:mcp` - Spawn server, call `evaluate_script` via stdio

## License

MIT © [ohah](https://github.com/ohah)
