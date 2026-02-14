---
name: tool-list-text-nodes
description: Use when calling MCP list_text_nodes or listing all visible text in the RN app (not only clickables).
---

# list_text_nodes

## How it works

- Server sends **eval**: `__REACT_NATIVE_MCP__.getTextNodes()`. App walks Fiber, collects **Text** node contents and optional **testID** (nearest ancestor). Requires DevTools hook for correct text.
- Returns all on-screen text; use for assertions or search. No parameters.
