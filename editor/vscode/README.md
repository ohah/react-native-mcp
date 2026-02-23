# React Native MCP DevTools

VS Code extension. Connects to the MCP server and provides a Chrome DevTools-style GUI (Console, Network, State, Renders, Component Tree) inside the editor.

## Preview

**State tab** — Component-level state change history, Hook change tracking

![State tab screenshot](https://github.com/ohah/react-native-mcp/raw/main/editor/vscode/assets/screenshot-state.png)

## Install & usage

- **Marketplace**: [React Native MCP DevTools](https://marketplace.visualstudio.com/items?itemName=ohah.react-native-mcp-devtools) — Install from VS Code
- **Local install**: [Installation & usage guide](https://ohah.github.io/react-native-mcp/en/mcp/vscode-extension) (English)
- **한국어**: [VS Code 확장 (DevTools)](https://ohah.github.io/react-native-mcp/ko/mcp/vscode-extension)

## Development

```bash
bun install
bun run build      # Build extension + webview
bun run watch      # Watch build
bun run package    # Create .vsix package
```

Press F5 to debug in Extension Development Host.
