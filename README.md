# React Native MCP Server

> [한국어 문서](./README_KO.md)

MCP(Model Context Protocol) server for React Native app automation and monitoring. Works with Cursor, Claude Desktop, and GitHub Copilot CLI.

## Features

- 🔍 Monitor React Native app state
- 📡 Track network requests
- 📝 Collect console logs
- 🤖 AI-powered debugging and automation

## Installation

```bash
npm install -g @ohah/react-native-mcp-server
```

Or use with `npx` without installation.

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
4. Add Metro plugin to your React Native app:

```js
// metro.config.js
const { withReactNativeMCP } = require('@ohah/react-native-mcp-server/metro-plugin');

module.exports = withReactNativeMCP({
  // your existing Metro config
});
```

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

## Development

- **Tools**: [mise](https://mise.jdx.dev/) (see `.mise.toml`), oxlint/oxfmt for linting/formatting
- **Scripts**:
  - `bun run build` - Build the server
  - `bun run mcp` - Run MCP server
  - `bun run dev` - Watch mode
  - `bun run test` - Run tests

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
    │   ├── index.ts            # CLI entry point
    │   ├── server/             # MCP + WebSocket server
    │   ├── tools/              # MCP Tools
    │   ├── metro-plugin/       # Metro plugin
    │   └── runtime/            # Auto-injected runtime code
    └── package.json
```

## License

MIT © [ohah](https://github.com/ohah)
