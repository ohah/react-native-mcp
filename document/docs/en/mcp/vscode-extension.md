# VS Code Extension (DevTools)

React Native MCP DevTools connects to the MCP server and provides a Chrome DevTools-like GUI inside VS Code.

## Features

### Console

Monitor your app's console logs in real time.

- Level filter (log, info, warn, error)
- Text search
- Auto-polling (Pause/Resume)

### Network

Display XHR/fetch requests in a Chrome DevTools Network-style layout.

- Request list: status code (color badge), method, URL, response time
- Detail pane (drag-resizable): Headers / Request / Response sub-tabs
- Auto-parse `responseHeaders` JSON strings
- Mock badge for mocked requests

### State

Track state change history for useState/useReducer/Zustand, etc.

- **Grouped view (default)**: Changes grouped by component, count badge, timeline border
  - Primitive changes shown inline (`3 → 5`, `"hello" → "world"`)
  - Object/array changes expandable with unified diff
- **Timeline view**: Full chronological history
- **Unified diff**: Changed keys highlighted in red(-)/green(+), unchanged keys dimmed
- Component filter

### Renders

Render profiling to detect unnecessary re-renders.

- Start/Stop profiling, real-time Refresh
- Hot component list: render count, unnecessary renders, memo status
- **Built-in component disambiguation**: `Text`, `View`, `Pressable`, etc. are qualified with the nearest user component
  - Example: `MyHeader > Text`, `CartItem > Pressable` (same `Text` separated by location)
- **nativeType badge**: Shows what native element a custom component renders to (e.g., `MyButton` → `Pressable`)
- Trigger analysis: state / props / context / parent classification with colored badges
- **Parent jump navigation**: Click parent name in Recent Renders to scroll & highlight that component
- Prop/State/Context change diff viewer
- `trigger: parent` with no changes → "Could be prevented with React.memo" hint

### Other

- **Component Tree** — Browse your app's React component tree in the sidebar
- **Accessibility Audit** — Display accessibility violations as inline editor warnings
- **Activity Bar** — View DevTools persistently in the sidebar
- **Connection management** — Red disconnect banner + Reconnect button, all panels auto-clear stale data
- **Device display** — Shows actual connected device info (selectable for multiple devices)

## Installation

### From the Marketplace

> If not yet published to the marketplace, use the local installation method below.

In VS Code: `Ctrl+Shift+X` → Search `React Native MCP DevTools` → Install.

### Local Installation via .vsix

```bash
cd editor/vscode
bun install
bun run package   # Creates react-native-mcp-devtools-x.x.x.vsix
```

Install the `.vsix` file:

```bash
code --install-extension react-native-mcp-devtools-0.1.0.vsix
```

Or in VS Code → Extensions → `...` menu → `Install from VSIX...`.

## Usage

### 1. Start MCP Server

The extension connects to the MCP server at `ws://localhost:12300`. Start the server and your app first:

```bash
# Start MCP server
npx @ohah/react-native-mcp-server

# Start app (separate terminal)
cd your-rn-project && npx react-native start
```

### 2. Auto-connect

The extension automatically connects on activation. Check the status bar:

- `$(circle-filled) React Native MCP — ios:iPhone 16` — Connected (shows device)
- `$(circle-outline) React Native MCP` — Disconnected (red background)

When disconnected, a red banner with a **Reconnect** button appears at the top of the DevTools panel. On disconnect, all panel data is automatically cleared so stale data from previous sessions is never shown.

### 3. Open DevTools

Two ways to open:

- **Activity Bar (sidebar)**: Click the React Native MCP icon in the Activity Bar → DevTools panel + Component Tree in sidebar
- **Editor tab**: `Ctrl+Shift+P` → `React Native MCP: Open DevTools` → Opens in a separate editor tab

### 4. Commands

| Command                                     | Description                                     |
| ------------------------------------------- | ----------------------------------------------- |
| `React Native MCP: Open DevTools`           | Open DevTools in editor tab                     |
| `React Native MCP: Refresh Component Tree`  | Refresh sidebar component tree                  |
| `React Native MCP: Run Accessibility Audit` | Run accessibility audit (shows inline warnings) |

## Settings

Configure in `settings.json`:

```json
{
  "reactNativeMcp.port": 12300,
  "reactNativeMcp.autoConnect": true
}
```

| Setting                      | Default | Description                     |
| ---------------------------- | ------- | ------------------------------- |
| `reactNativeMcp.port`        | `12300` | MCP server WebSocket port       |
| `reactNativeMcp.autoConnect` | `true`  | Auto-connect on VS Code startup |

For extension development (build, debug, architecture), see [Contribute](/contribute).
