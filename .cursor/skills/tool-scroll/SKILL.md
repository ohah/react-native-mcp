---
name: tool-scroll
description: Use when calling MCP scroll or scrolling a ScrollView by testID in React Native app.
---

# scroll

## How it works

- Server sends **eval** that calls the **registered** ScrollView ref’s `scrollTo({ x, y, animated })`.
- The app must have called `__REACT_NATIVE_MCP__.registerScrollRef(testID, ref)` so the server can resolve **uid** (testID) to a ref. No ref → scroll does nothing.
- Host-side only; no CDP. Parameters: **uid** (required), **x**, **y**, **animated** (optional).
