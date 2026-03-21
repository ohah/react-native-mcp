# rn-mcp CLI (Snapshot + Refs)

A shell-first interface for AI agents to control React Native apps. Uses the **Snapshot + Refs** pattern inspired by [agent-browser](https://github.com/vercel-labs/agent-browser) for token-efficient interaction.

## Why CLI?

| | MCP Tools | rn-mcp CLI |
|---|---|---|
| **Token cost** | High — full JSON responses per tool call | Low — compact refs (`@e1`, `@e2`) |
| **Steps to tap** | query_selector → extract coords → tap (3 calls) | `rn-mcp tap @e3` (1 call) |
| **Setup** | MCP client config required | Shell command, no config |
| **Best for** | Cursor, Windsurf (MCP-only editors) | Claude Code, Codex, shell scripts |

## Installation

The CLI is included in the same package:

```bash
# Global install
npm install -g @ohah/react-native-mcp-server

# Or use npx
npx rn-mcp --help

# Or project-local
npm install -D @ohah/react-native-mcp-server
npx rn-mcp --help
```

## Prerequisites

- MCP server must be running (started by your editor or `npx react-native-mcp-server`)
- App must be running on a simulator/emulator and connected via WebSocket (port 12300)
- iOS: [idb](https://fbidb.io/) installed
- Android: [adb](https://developer.android.com/tools/adb) installed

## Workflow

```bash
# 1. Check connection
rn-mcp status

# 2. Get interactive elements as @refs
rn-mcp snapshot -i

# 3. Interact using @refs
rn-mcp tap @e3
rn-mcp type @e5 "user@example.com"

# 4. After screen transition, refresh refs
rn-mcp snapshot -i
```

### Snapshot output example

```
@e1   View #login-screen
@e2     TextInput #email "Email"
@e3     TextInput #password "Password"
@e4     Pressable #login-btn "Sign In"
@e5     Pressable #signup-link "Create Account"
```

Each element gets a short ref (`@e1`, `@e2`, ...) assigned in depth-first order.

## Commands

### Connection

| Command | Description |
|---------|-------------|
| `rn-mcp status` | Show connection status and devices |

### Snapshot

| Command | Description |
|---------|-------------|
| `rn-mcp snapshot` | Full component tree with @refs |
| `rn-mcp snapshot -i` | Interactive elements only (recommended) |
| `rn-mcp snapshot --max-depth 10` | Limit tree depth |
| `rn-mcp snapshot -i --json` | JSON output for scripting |

### Interaction

| Command | Description |
|---------|-------------|
| `rn-mcp tap @e3` | Tap element by ref |
| `rn-mcp tap "#login-btn"` | Tap by selector |
| `rn-mcp tap @e3 --long 500` | Long press (500ms) |
| `rn-mcp type @e5 "text"` | Type into TextInput |
| `rn-mcp swipe @e2 down` | Swipe element |
| `rn-mcp swipe @e2 down --dist 300` | Swipe with distance |
| `rn-mcp key back` | Press hardware key |

Available keys: `back`, `home`, `enter`, `tab`, `delete`, `up`, `down`, `left`, `right`

### Assertions

| Command | Description |
|---------|-------------|
| `rn-mcp assert text "Welcome"` | Verify text exists (exit 0/1) |
| `rn-mcp assert visible @e3` | Verify element is visible |
| `rn-mcp assert not-visible @e3` | Verify element is NOT visible |
| `rn-mcp assert count "Pressable" 5` | Verify element count |

### Query

| Command | Description |
|---------|-------------|
| `rn-mcp query "#my-btn"` | Query single element info |
| `rn-mcp query --all "Pressable"` | Query all matching elements |

### Screenshot

| Command | Description |
|---------|-------------|
| `rn-mcp screenshot` | Save screenshot (default: screenshot.png) |
| `rn-mcp screenshot -o login.png` | Save to specific file |

### Agent Guide Setup

| Command | Description |
|---------|-------------|
| `rn-mcp init-agent` | Add CLI guide to AGENTS.md + CLAUDE.md |
| `rn-mcp init-agent --lang ko` | Korean guide |
| `rn-mcp init-agent --target claude` | CLAUDE.md only |

## Global Options

```
-d, --device <id>        Target device (when multiple connected)
-p, --platform <os>      ios or android
--port <n>               WebSocket port (default: 12300)
--json                   JSON output for scripting
--timeout <ms>           Command timeout (default: 10000)
```

## Refs System

### How refs work

1. `rn-mcp snapshot -i` assigns `@e1`, `@e2`, ... to each element (depth-first order)
2. Refs are saved to `~/.rn-mcp/session.json`
3. Subsequent commands use refs: `rn-mcp tap @e3`
4. Running snapshot again **invalidates all previous refs**

### When to re-snapshot

- After screen transitions (navigation, modal open/close)
- When `@ref not found` error occurs
- After actions that change the UI structure

### Selectors (alternative to refs)

You can also use selectors directly without snapshot:

```bash
rn-mcp tap "#login-btn"                    # by testID
rn-mcp tap "Pressable:text(\"Sign In\")"   # by type + text
rn-mcp tap "TextInput[placeholder=\"Email\"]"  # by attribute
```

## Important Notes

- **iOS orientation** is handled automatically — no manual action needed
- **Android dp→px conversion** is automatic
- **Coordinates are in points (dp)**, not pixels
- Use `--json` flag for programmatic output parsing

## Example: Login Flow

```bash
# Check connection
rn-mcp status

# See what's on screen
rn-mcp snapshot -i
# @e1   TextInput #email "Email"
# @e2   TextInput #password "Password"
# @e3   Pressable #login-btn "Sign In"

# Fill form and submit
rn-mcp type @e1 "test@example.com"
rn-mcp type @e2 "password123"
rn-mcp tap @e3

# Verify navigation
rn-mcp assert text "Dashboard"

# Get new screen's elements
rn-mcp snapshot -i
```
