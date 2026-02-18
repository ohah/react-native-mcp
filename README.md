# React Native MCP Server

> [한국어 문서](./README_KO.md)

MCP(Model Context Protocol) server for React Native app automation and monitoring. Works with Cursor, Claude Desktop, and GitHub Copilot CLI.

## Features

- 🔍 Monitor React Native app state
- 📡 Track network requests
- 📝 Collect console logs
- 🤖 AI-powered debugging and automation

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

```
 Applying changes...
  ✓ babel.config.js — preset added
  ✓ MCP config — created .cursor/mcp.json
  ✓ .gitignore — updated
```

**Step 4 — Next Steps**

Shows what to do after setup:

```
 Done! Next steps:
  1. Start your app: npx expo start           # Expo
     Start Metro: REACT_NATIVE_MCP_ENABLED=true npx react-native start  # bare RN
  2. Open Cursor — MCP tools are ready to use
```

### Options

```bash
# Non-interactive mode — skip prompts, use Cursor as default client
npx -y @ohah/react-native-mcp-server init -y

# Specify client explicitly (no prompt)
npx -y @ohah/react-native-mcp-server init --client cursor
npx -y @ohah/react-native-mcp-server init --client claude-code
npx -y @ohah/react-native-mcp-server init --client claude-desktop
npx -y @ohah/react-native-mcp-server init --client windsurf
npx -y @ohah/react-native-mcp-server init --client antigravity

# CI — combine both
npx -y @ohah/react-native-mcp-server init --client cursor -y

# Help
npx -y @ohah/react-native-mcp-server init --help
```

### Idempotent

Running `init` multiple times is safe. Each step checks if the change is already applied and skips if so:

```
  ✓ babel.config.js — preset already configured
  ✓ MCP config — already configured
  ✓ .gitignore — already has results/
```

## Installation

**Prerequisites:** Node.js 18+ or Bun (e.g. [mise](https://mise.jdx.dev/): `mise install` in this repo, or install [Node](https://nodejs.org/) / [Bun](https://bun.sh/) globally).

Use with **npx** (no global install):

```bash
npx -y @ohah/react-native-mcp-server
```

For Cursor/Claude/Copilot, set `"command": "npx"` and `"args": ["-y", "@ohah/react-native-mcp-server"]` in MCP config (see Usage below).

Optional: global install

```bash
npm install -g @ohah/react-native-mcp-server
```

## Usage

### Cursor

1. Open **Cursor Settings** → **MCP** (or edit `.cursor/mcp.json` in your project)
2. Add the following configuration:

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

3. Restart Cursor (or refresh MCP)
4. In your React Native app, add the Babel preset and enable the MCP runtime. For console/network tools, run Metro as usual (the MCP server connects to Metro’s debugger endpoint; no Metro config change is required).

**Babel** — add the preset (AppRegistry wrapping, auto testID injection):

```js
// babel.config.js
module.exports = {
  presets: ['module:@react-native/babel-preset', '@ohah/react-native-mcp-server/babel-preset'],
};
```

**Applying the preset per build type**  
You can use `process.env` in `babel.config.js` to include the preset only for certain builds.

- **Dev only** (exclude from release):

```js
const isDev = process.env.NODE_ENV !== 'production';
const mcpPreset = isDev ? ['@ohah/react-native-mcp-server/babel-preset'] : [];
module.exports = {
  presets: ['module:@react-native/babel-preset', ...mcpPreset],
};
```

- **Release only**: use `process.env.NODE_ENV === 'production'` instead of `isDev`.
- **Custom env**: e.g. add the preset only when `process.env.ENABLE_MCP === '1'`.

6. **Enable the MCP runtime**: run Metro with the env var so the transformer injects the flag (no app code change).

   ```bash
   REACT_NATIVE_MCP_ENABLED=true npx react-native start
   ```

   `true` or `1` enables MCP. When unset, the Metro transformer and Babel preset apply no MCP transforms, so no MCP code is included in the bundle. In `__DEV__` (development) the runtime also connects automatically when the env var is set.

> **Expo?** See the [Expo Guide](./docs/expo-guide.md) for Expo-specific setup (babel-preset-expo, Expo Router `app/_layout.tsx`, Dev Client vs Expo Go).

### Expo

React Native MCP works with Expo projects. The CLI init command (`npx -y @ohah/react-native-mcp-server init`) auto-detects Expo and configures everything correctly.

For detailed Expo setup (babel-preset-expo, Expo Router, Dev Client vs Expo Go), see the [Expo Guide](./docs/expo-guide.md).

### Claude Desktop

Edit Claude Desktop configuration file:

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

Add the following:

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

Restart Claude Desktop.

### GitHub Copilot CLI

Use the `/mcp` command to add the server:

```bash
copilot
> /mcp add react-native-mcp
```

When prompted, enter:

- **Command**: `npx`
- **Args**: `-y @ohah/react-native-mcp-server`

Or manually edit `~/.copilot/mcp-config.json`:

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

Restart the Copilot CLI.

## Required: Native Tools (idb / adb)

The MCP server uses **idb** (iOS) and **adb** (Android) for native touch injection (`tap`, `swipe`, `input_text`, etc.) and screenshots. These are **required** for full functionality.

### Android (adb)

adb is included with Android Studio. If not already installed:

```bash
# macOS
brew install --cask android-platform-tools

# Or install Android Studio — adb is at ~/Library/Android/sdk/platform-tools/adb
```

Verify: `adb devices`

### iOS Simulator (idb)

[idb (iOS Development Bridge)](https://fbidb.io/) is required for iOS simulator automation:

```bash
brew tap facebook/fb && brew install idb-companion
pip3 install fb-idb
```

Verify: `idb list-targets`

> **Note**: idb is macOS-only and supports simulators only. For real iOS devices, XCTest/WDA setup is needed.

See [idb Setup Guide](./docs/idb-setup.md) for details and troubleshooting.

## Development

- **Tools**: [mise](https://mise.jdx.dev/) (see `.mise.toml`), oxlint/oxfmt for linting/formatting
- **Scripts**:
  - `bun run build` - Build the server
  - `bun run mcp` - Run MCP server
  - `bun run dev` - Watch mode
  - `bun run test` - Run tests
  - `bun run test:mcp` - Spawn server, call `evaluate_script` via stdio (no app: "No app connected"; with app: result)

### Testing the MCP server

From the repo root (after `bun install`):

```bash
bun run test:mcp
```

This builds the server, starts it, sends MCP `initialize` → `notifications/initialized` → `tools/call` (`evaluate_script`, e.g. function `() => 1 + 2`), and prints the result. Without a connected React Native app you see "No React Native app connected". With the demo app running and connected to `ws://localhost:12300`, you see the evaluation result (e.g. `3`).

### Running E2E tests (YAML)

E2E tests are defined as YAML files under `examples/demo-app/e2e/` (e.g. `press-counter.yaml`). The runner starts the MCP server, launches the demo app, and runs the steps. **YAML syntax reference:** [E2E YAML Reference (API docs)](docs/e2e-yaml-reference.md).

From the repo root (after `bun run build`, and with idb/adb available):

```bash
# iOS (simulator must be booted, app built and installed)
bun run test:e2e -- -p ios

# Android (emulator/device with app installed, adb reverse tcp:12300 tcp:12300)
bun run test:e2e -- -p android
```

To run a single YAML file or another directory:

```bash
npx react-native-mcp-test run examples/demo-app/e2e/press-counter.yaml -p ios
npx react-native-mcp-test run path/to/your/e2e/ -p android
```

## Architecture

```
React Native App (iOS/Android)
  ↓ (WebSocket)
  └─ Runtime (auto-injected via Metro)
       ↓
     MCP Server (developer's machine)
       ↓ (stdio/MCP protocol)
     Cursor / Claude Desktop / Copilot CLI
```

## Package Structure

```
packages/
└── react-native-mcp-server/    # Single package with everything
    ├── src/
    │   └── index.ts            # CLI entry point (MCP server + CLI)
    ├── tests/                  # Test files
    └── package.json
```

## License

MIT © [ohah](https://github.com/ohah)
