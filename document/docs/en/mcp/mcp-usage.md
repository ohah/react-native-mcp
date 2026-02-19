---
description: How to connect and use the React Native MCP server in Cursor, Claude Desktop, and GitHub Copilot CLI.
---

# Using MCP

How to connect and use the React Native MCP server in Cursor, Claude Desktop, and GitHub Copilot CLI.

## Common setup

Register the MCP server in each client as follows.

- **Command**: `npx`
- **Args**: `-y @ohah/react-native-mcp-server`

The server talks over stdio using the MCP protocol; the app connects to it via WebSocket through Metro.

---

## Cursor

1. Open **Cursor Settings** → **MCP**, or edit `.cursor/mcp.json` in your project
2. Add:

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

3. Restart Cursor or refresh MCP
4. Run the app with Metro and open it in the simulator/emulator
5. In chat, use MCP tools (take_snapshot, tap, assert_text, etc.) to control and verify the app

---

## Claude Desktop / Claude CLI

### Option A: Claude CLI `mcp add` (recommended)

If you use [Claude Code](https://code.claude.com/) or the Claude CLI, add the server with:

```bash
claude mcp add --transport stdio react-native-mcp -- npx -y @ohah/react-native-mcp-server
```

Then run your app and use MCP tools in the conversation. Use `claude mcp list` to confirm the server is registered.

### Option B: Edit config file

1. Edit the config file:
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
2. Add:

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

3. Restart Claude Desktop
4. Run your app and use MCP tools in the conversation

---

## GitHub Copilot CLI

1. Run Copilot CLI and run `/mcp add react-native-mcp`
2. When prompted:
   - **Command**: `npx`
   - **Args**: `-y @ohah/react-native-mcp-server`
3. Or edit `~/.copilot/mcp-config.json` with the same structure
4. Restart Copilot CLI

---

## Available tools overview

Once connected, **42 tools** are available across 12 categories — interaction, assertions, screen capture, network mocking, state inspection, render profiling, and more.

Ask the AI to "take a snapshot of the app" or "tap the login button" and it will call these tools automatically.

For detailed parameters, examples, and platform-specific tips for every tool, see the **[Tool Reference](./tools/)**. For real-world usage scenarios, check out the **[Cookbook](./cookbook/)**.

---

## Enabling the MCP runtime

For the app to connect to the MCP server (WebSocket 12300), enable it at **build time** with an environment variable. No code is required in your app entry (`index.js`).

- When starting Metro: set `REACT_NATIVE_MCP_ENABLED=true` or `REACT_NATIVE_MCP_ENABLED=1`

  ```bash
  REACT_NATIVE_MCP_ENABLED=true npx react-native start
  ```

- In development (`__DEV__ === true`), the runtime also tries to connect automatically without this env var.

---

## When connection fails

If you see "No app connected" or tools aren't working, check the **[Troubleshooting](./troubleshooting)** page for step-by-step diagnosis — covering duplicate processes, port conflicts, localhost issues, and missing runtime injection.
