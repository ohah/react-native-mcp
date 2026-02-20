# Element Query

Tools for finding elements in the React Native component tree and executing JavaScript in the app or WebView context.

## query_selector

Find the first element matching a selector in the React Fiber tree. Returns UID, type, and measurement (position + size).

#### Parameters

| Parameter  | Type                 | Required | Description                                                                |
| ---------- | -------------------- | -------- | -------------------------------------------------------------------------- |
| `selector` | `string`             | **Yes**  | Selector for the RN Fiber tree (see [Selector Syntax](./#selector-syntax)) |
| `platform` | `"ios" \| "android"` | No       | Target platform                                                            |
| `deviceId` | `string`             | No       | Target device                                                              |

#### Example

```json
// Find by testID
{ "tool": "query_selector", "arguments": { "selector": "#submit-btn" } }

// Find by text content
{ "tool": "query_selector", "arguments": { "selector": ":text(\"Login\")" } }

// Find by hierarchy
{ "tool": "query_selector", "arguments": { "selector": "ScrollView > View > Text" } }

// Response
{
  "uid": "submit-btn",
  "type": "View",
  "testID": "submit-btn",
  "measure": { "pageX": 120, "pageY": 580, "width": 200, "height": 48 }
}
```

#### Tips

- This is the **entry point** for most interaction workflows: `query_selector` → get coordinates → `tap`.
- Tap the center of an element: `x = pageX + width/2`, `y = pageY + height/2`.
- UIDs are not known ahead of time — always call `query_selector` first to discover them.

---

## query_selector_all

Find **all** elements matching a selector. Returns an array with measurements.

#### Parameters

| Parameter  | Type                 | Required | Description                    |
| ---------- | -------------------- | -------- | ------------------------------ |
| `selector` | `string`             | **Yes**  | Selector for the RN Fiber tree |
| `platform` | `"ios" \| "android"` | No       | Target platform                |
| `deviceId` | `string`             | No       | Target device                  |

#### Example

```json
// Find all list items
{ "tool": "query_selector_all", "arguments": { "selector": "#list-item" } }

// Response
[
  { "uid": "list-item-0", "type": "View", "measure": { "pageX": 0, "pageY": 100, "width": 375, "height": 60 } },
  { "uid": "list-item-1", "type": "View", "measure": { "pageX": 0, "pageY": 160, "width": 375, "height": 60 } }
]
```

#### Tips

- Prefer `query_selector` when you only need one element.
- Use this to enumerate lists, count visible items, or iterate over multiple matches.

---

## evaluate_script

Run JavaScript in the app's runtime context. Use `measureView(uid)` to get tap/swipe coordinates.

#### Parameters

| Parameter  | Type                 | Required | Description                                                                            |
| ---------- | -------------------- | -------- | -------------------------------------------------------------------------------------- |
| `function` | `string`             | **Yes**  | JS function string. e.g. `"() => measureView('my-btn')"`. `require()` is not available |
| `args`     | `array`              | No       | Arguments passed to the function                                                       |
| `platform` | `"ios" \| "android"` | No       | Target platform                                                                        |
| `deviceId` | `string`             | No       | Target device                                                                          |

#### Example

```json
// Measure a view by UID
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "(uid) => measureView(uid)",
    "args": ["submit-btn"]
  }
}

// Get registered WebView IDs
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "() => getRegisteredWebViewIds()"
  }
}

// Access app globals
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "() => ({ width: globalThis.screen?.width, height: globalThis.screen?.height })"
  }
}
```

#### Tips

- `measureView(uid)` returns `{ pageX, pageY, width, height }` — useful for computing tap targets.
- `require()` is **not** available. Only access globals and the built-in MCP helpers.
- The function is wrapped in a try-catch and executed via WebSocket.

---

## webview_evaluate_script

Run JavaScript inside an in-app WebView. Useful for DOM manipulation, form filling, or reading web content.

#### Parameters

| Parameter   | Type                 | Required | Description                                                                                 |
| ----------- | -------------------- | -------- | ------------------------------------------------------------------------------------------- |
| `webViewId` | `string`             | **Yes**  | WebView ID. Discover with `evaluate_script(() => getRegisteredWebViewIds())`                |
| `script`    | `string`             | **Yes**  | JS to run in the WebView (DOM queries, clicks, etc.). Must evaluate to a value for a result |
| `platform`  | `"ios" \| "android"` | No       | Target platform                                                                             |
| `deviceId`  | `string`             | No       | Target device                                                                               |

#### Example

```json
// Get WebView IDs first
{
  "tool": "evaluate_script",
  "arguments": { "function": "() => getRegisteredWebViewIds()" }
}
// Response: ["webview-0"]

// Click a button inside the WebView
{
  "tool": "webview_evaluate_script",
  "arguments": {
    "webViewId": "webview-0",
    "script": "document.querySelector('#login-btn').click(); 'clicked'"
  }
}
```

#### Tips

- Prefer this over `tap` for WebView DOM interactions — it's faster and more reliable.
- WebViews are auto-registered by the babel plugin. Use `getRegisteredWebViewIds()` to discover available IDs.
- The script must evaluate to a value to return a result. End with a string or expression.
