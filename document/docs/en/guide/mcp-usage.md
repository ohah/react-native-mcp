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

## Claude Desktop

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

Once connected, you can use tools such as:

| Purpose   | Tools                                                |
| --------- | ---------------------------------------------------- |
| View UI   | `take_snapshot`, `take_screenshot`, `query_selector` |
| Assert    | `assert_text`, `assert_visible`                      |
| Interact  | `tap`, `swipe`, `input_text`, `type_text`            |
| Run       | `evaluate_script`, `webview_evaluate_script`         |
| Device    | `get_debugger_status`, `list_devices`                |
| Deep link | `open_deeplink`                                      |
| Debug     | `list_console_messages`, `list_network_requests`     |

Ask the AI to “take a snapshot of the app” or “tap the login button” and it will call these tools.

---

## When connection fails

- **App not connected**: Check that Metro is running and the app has the Metro plugin and Babel preset
- **Tap/screenshot not working**: Ensure idb (iOS) or adb (Android) is installed and the device is listed (`idb list-targets`, `adb devices`)
- **Single tool failing**: Check arguments (selector, timeout, etc.) and that the app UI is loaded

See the repo `docs/` folder for more troubleshooting.
