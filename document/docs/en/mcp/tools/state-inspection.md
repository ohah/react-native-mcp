# State Inspection

Tools for inspecting React component state hooks and tracking state changes over time.

## inspect_state

Inspect React state hooks of a component found by selector. Works with `useState`, Zustand, and other hook-based state.

#### Parameters

| Parameter  | Type                 | Required | Description                                                   |
| ---------- | -------------------- | -------- | ------------------------------------------------------------- |
| `selector` | `string`             | **Yes**  | Selector for the component (e.g., `CartScreen`, `#cart-view`) |
| `platform` | `"ios" \| "android"` | No       | Target platform                                               |
| `deviceId` | `string`             | No       | Target device                                                 |

#### Example

```json
// Inspect state of a component
{
  "tool": "inspect_state",
  "arguments": { "selector": "#cart-view" }
}

// Response
{
  "component": "CartScreen",
  "hooks": [
    { "index": 0, "type": "useState", "value": [{ "id": 1, "name": "Widget", "qty": 2 }] },
    { "index": 1, "type": "useState", "value": true },
    { "index": 2, "type": "useState", "value": "loading" }
  ]
}
```

#### Tips

- The `selector` targets a React component in the Fiber tree — same syntax as `query_selector`.
- Hook `index` corresponds to the order of `useState` calls in the component source code.
- Works with `useState`, Zustand stores, and other hook-based state management.
- Use this to verify internal state without relying solely on visual output.

---

## get_state_changes

List captured state changes over time. Shows previous and next values for each change.

#### Parameters

| Parameter   | Type                 | Required | Description                                       |
| ----------- | -------------------- | -------- | ------------------------------------------------- |
| `component` | `string`             | No       | Filter by component name. Omit for all components |
| `since`     | `number`             | No       | Only return changes after this timestamp (ms)     |
| `limit`     | `number`             | No       | Max changes to return. Default: `100`             |
| `platform`  | `"ios" \| "android"` | No       | Target platform                                   |
| `deviceId`  | `string`             | No       | Target device                                     |

#### Example

```json
// Get all recent state changes
{ "tool": "get_state_changes" }

// Filter by component
{
  "tool": "get_state_changes",
  "arguments": { "component": "CartScreen", "limit": 10 }
}

// Response
[
  {
    "id": 1,
    "timestamp": 1700000001234,
    "component": "CartScreen",
    "hookIndex": 0,
    "prev": [],
    "next": [{ "id": 1, "name": "Widget", "qty": 1 }]
  },
  {
    "id": 2,
    "timestamp": 1700000002000,
    "component": "CartScreen",
    "hookIndex": 0,
    "prev": [{ "id": 1, "name": "Widget", "qty": 1 }],
    "next": [{ "id": 1, "name": "Widget", "qty": 2 }]
  }
]
```

#### Tips

- The buffer stores up to **300** state changes. Use `clear` (target: `state_changes`) to reset.
- Use `since` to get only new changes since your last check.
- Combine with `inspect_state` for a complete picture: current state + change history.

To clear the state change buffer, use the unified **clear** tool with `target: "state_changes"`:

```json
{ "tool": "clear", "arguments": { "target": "state_changes" } }
```

Call before a test scenario to get a clean history.
