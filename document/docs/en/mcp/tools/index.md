---
description: Reference for all 42 MCP tools (tap, snapshot, assert, etc.) with selector syntax and common parameters.
---

# Tool Reference

React Native MCP provides **42 tools** across 12 categories. Every tool is available to any MCP-compatible client (Cursor, Claude, Copilot, etc.) out of the box.

## Common Parameters

Most tools accept these optional parameters:

| Parameter  | Type                 | Description                                                                                                                    |
| ---------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `deviceId` | `string`             | Target device ID. Omit when only one device is connected — auto-selected. Use `get_debugger_status` to list connected devices. |
| `platform` | `"ios" \| "android"` | Target platform. Auto-detected when only one device of that platform is connected.                                             |

## Selector Syntax

Several tools accept a `selector` parameter that queries the React Native Fiber tree. The syntax supports:

| Pattern     | Example                        | Description                |
| ----------- | ------------------------------ | -------------------------- |
| Type        | `Text`                         | Match by component type    |
| testID      | `#submit-btn`                  | Match by testID prop       |
| Text        | `:text("Hello")`               | Match by text content      |
| Attribute   | `[accessibilityLabel="Close"]` | Match by prop value        |
| displayName | `:display-name("MyComponent")` | Match by display name      |
| Index       | `:nth-of-type(2)`              | Match Nth element of type  |
| Capability  | `:has-press`                   | Pressable elements         |
| Hierarchy   | `ScrollView > View > Text`     | Direct child or descendant |
| OR          | `#btn-a, #btn-b`               | Match either selector      |

See each tool page for detailed parameter tables, examples, and platform-specific tips.

## Categories

| Category                               | Tools | Description                                                              |
| -------------------------------------- | ----- | ------------------------------------------------------------------------ |
| [Device & Status](./device)            | 5     | Connection status, device listing, deep links, GPS, app reset            |
| [Screen Capture](./screen-capture)     | 4     | Screenshots, component tree snapshots, native UI tree, visual comparison |
| [Element Query](./element-query)       | 4     | Find elements, run JS in app or WebView                                  |
| [Interaction](./interaction)           | 8     | Tap, swipe, text input, key events, scrolling                            |
| [Assertions](./assertions)             | 4     | Verify text, visibility, element count                                   |
| [Console & Network](./console-network) | 4     | Inspect console logs and network requests                                |
| [Network Mocking](./network-mocking)   | 4     | Mock API responses without backend changes                               |
| [State Inspection](./state-inspection) | 3     | Inspect React hooks and state changes                                    |
| [Render Profiling](./render-profiling) | 3     | Profile renders, find unnecessary re-renders                             |
| [Accessibility](./accessibility)       | 1     | Automated accessibility audit                                            |
| [File & Media](./file-media)           | 2     | Push files, add photos/videos to gallery                                 |
