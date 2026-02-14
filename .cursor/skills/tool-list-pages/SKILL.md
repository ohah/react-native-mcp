---
name: tool-list-pages
description: Use when calling MCP list_pages or needing a single “page” handle for RN (Chrome DevTools MCP compat).
---

# list_pages

## How it works

- No app or CDP. Server returns a fixed list of one page: `id=1`, `title="React Native App"`, `url="react-native://app"`. Aligns with Chrome DevTools MCP “list pages” so clients can treat RN as one page. No parameters.
