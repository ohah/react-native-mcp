---
name: tool-take-snapshot
description: Use when calling MCP take_snapshot or exploring RN component tree (Fiber) by type/uid.
---

# take_snapshot

## How it works

- Server sends **eval**: `__REACT_NATIVE_MCP__.getComponentTree({ maxDepth })`. App walks the **React Fiber** tree and returns a tree of nodes (type, testID, accessibilityLabel, text, children).
- **uid**: equals testID when present, otherwise a path string (e.g. `"0.1.2"`). Use uid with **click** only when it is a testID.
- No DevTools hook required. Use for querySelector-like exploration and to get testIDs for **click**.
