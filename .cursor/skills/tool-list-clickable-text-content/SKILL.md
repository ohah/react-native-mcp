---
name: tool-list-clickable-text-content
description: Use when calling MCP list_clickable_text_content or verifying button/clickable text (textContent).
---

# list_clickable_text_content

## How it works

- Server sends **eval**: `__REACT_NATIVE_MCP__.getClickableTextContent()`. App walks Fiber, finds nodes with **onPress**, and for each returns full **text** (textContent of that subtree) and optional **testID**. Like `querySelector` + `textContent` for clickables.
- Use to assert visible label text of buttons/clickables. Returns `[{ text, testID? }]`. No parameters.
