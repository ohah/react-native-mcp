# @ohah/react-native-mcp-server

> [한국어 문서](./README_KO.md)

MCP (Model Context Protocol) server for React Native app automation and monitoring. Lets AI assistants (Cursor, Claude Desktop, GitHub Copilot CLI) inspect and control your React Native app over WebSocket.

## Features

- Monitor app state, network requests, and console logs
- Tap, swipe, type text, take screenshots via idb (iOS) / adb (Android)
- Query the component tree, run scripts in the app context
- One-command setup with `init`

## Install

**Prerequisites:** Node.js 18+ or Bun. For tap/swipe/screenshots you need [idb](https://fbidb.io/) (iOS, macOS) and [adb](https://developer.android.com/tools/adb) (Android).

No global install required — use with npx:

```bash
npx -y @ohah/react-native-mcp-server init
```

This detects your project (React Native / Expo, package manager), asks for your MCP client (Cursor, Claude, etc.), and configures Babel + MCP config + .gitignore.

Or install globally:

```bash
npm install -g @ohah/react-native-mcp-server
```

## Quick Start

1. **Setup** (once per project):

   ```bash
   npx -y @ohah/react-native-mcp-server init
   ```

2. **Start your app.** In development, the MCP runtime is included automatically (no extra env needed). Example:

   ```bash
   npx react-native start
   # or for Expo: npx expo start
   ```

   To enable MCP in release builds, run Metro with `REACT_NATIVE_MCP_ENABLED=true` or set it in your build config.

3. **Configure your MCP client** (e.g. Cursor → Settings → MCP). The init command creates the config; typical entry:

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

4. Open your app and Cursor (or Claude/Copilot); the server connects to the app automatically.

## Init options

```bash
npx -y @ohah/react-native-mcp-server init -y                    # Non-interactive (Cursor default)
npx -y @ohah/react-native-mcp-server init --client cursor       # Cursor
npx -y @ohah/react-native-mcp-server init --client claude-code  # Claude Code (CLI)
npx -y @ohah/react-native-mcp-server init --client claude-desktop
npx -y @ohah/react-native-mcp-server init --help
```

## Manual Babel setup

If you prefer not to use `init`, add the Babel preset yourself so the app can connect to the MCP server:

```js
// babel.config.js
module.exports = {
  presets: [
    'module:@react-native/babel-preset', // or your existing preset
    '@ohah/react-native-mcp-server/babel-preset',
  ],
};
```

### Babel preset options

Pass options as the second element of the preset array:

| Option            | Type                                                  | Default | Description                                                             |
| ----------------- | ----------------------------------------------------- | ------- | ----------------------------------------------------------------------- |
| `renderHighlight` | `boolean` or `{ style: 'react-scan' \| 'react-mcp' }` | `false` | Start render highlight on load. `true` = style `'react-mcp'` (default). |

- **`true`** — enable with style `'react-mcp'` (cyan #61dafb, default, matches DevTools icon).
- **`{ style: 'react-mcp' }`** — same as `true`.
- **`{ style: 'react-scan' }`** — purple, react-scan style.

Example:

```js
presets: [
  'module:@react-native/babel-preset',
  ['@ohah/react-native-mcp-server/babel-preset', { renderHighlight: true }],
  // or: { renderHighlight: { style: 'react-scan' } }  for purple
],
```

Then add the MCP server entry to your client config (e.g. `.cursor/mcp.json` or Claude config) as in the Quick Start step 3.

## Native tools (idb / adb)

For tap, swipe, screenshots, and similar tools you need:

| Platform      | Tool | Install                                                                                    |
| ------------- | ---- | ------------------------------------------------------------------------------------------ |
| iOS Simulator | idb  | `brew tap facebook/fb && brew install idb-companion` (macOS)                               |
| Android       | adb  | Install Android Studio (adb is included), or `brew install android-platform-tools` (macOS) |

Without these, other MCP tools (state, network, console, eval) still work.

## Documentation

- **Full docs:** [ohah.github.io/react-native-mcp](https://ohah.github.io/react-native-mcp/) ([en](https://ohah.github.io/react-native-mcp/mcp/getting-started) / [ko](https://ohah.github.io/react-native-mcp/ko/mcp/getting-started))
- **VS Code Extension:** Install from [Marketplace](https://marketplace.visualstudio.com/items?itemName=ohah.react-native-mcp-devtools) or `Ctrl+Shift+X` → search **React Native MCP DevTools**. [Doc](https://ohah.github.io/react-native-mcp/mcp/vscode-extension) ([ko](https://ohah.github.io/react-native-mcp/ko/mcp/vscode-extension))
- **Tool Reference:** [mcp/tools/overview](https://ohah.github.io/react-native-mcp/mcp/tools/overview) · **E2E Testing:** [YAML scenarios](https://ohah.github.io/react-native-mcp/test/)
- **Repository:** [github.com/ohah/react-native-mcp](https://github.com/ohah/react-native-mcp)

## License

MIT
