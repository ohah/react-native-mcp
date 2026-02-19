# Render Profiling

Tools for profiling React component renders. Identify hot components, unnecessary re-renders, and optimization opportunities.

## Render highlight (visual overlay)

**`start_render_highlight`** and **`stop_render_highlight`** draw colored rectangles on the device screen around components that re-render (react-scan style). Use them to see which parts of the UI update when you interact with the app.

- **Start:** `start_render_highlight` (optional args: `whitelist`, `showLabels`, `fadeAfterMs`, `maxHighlights`). You can also enable it at app load via the Babel preset option `renderHighlight: true` (default style `react-mcp`) or `renderHighlight: { style: 'react-scan' }` — see [Install & connect](../#render-highlight-optional).
- **Stop:** `stop_render_highlight` removes all overlay rects.

The VS Code [DevTools Renders panel](../vscode-extension) provides a "Highlight" button that calls these tools.

## start_render_profile

Start render profiling. Tracks component mounts, re-renders, and unnecessary renders caused by parent re-renders.

#### Parameters

| Parameter    | Type                 | Required | Description                                                                                       |
| ------------ | -------------------- | -------- | ------------------------------------------------------------------------------------------------- |
| `components` | `string[]`           | No       | Whitelist: only track these components. Overrides `ignore`                                        |
| `ignore`     | `string[]`           | No       | Blacklist: skip these components (added to default ignore list). Ignored when `components` is set |
| `platform`   | `"ios" \| "android"` | No       | Target platform                                                                                   |
| `deviceId`   | `string`             | No       | Target device                                                                                     |

#### Example

```json
// Profile all components
{ "tool": "start_render_profile" }

// Profile specific components only
{
  "tool": "start_render_profile",
  "arguments": { "components": ["ProductList", "CartScreen", "Header"] }
}

// Ignore noisy components
{
  "tool": "start_render_profile",
  "arguments": { "ignore": ["AnimatedView", "SafeAreaView"] }
}
```

#### Tips

- Use `components` to focus on specific screens or features.
- Use `ignore` to filter out framework components that produce noise.
- Start profiling → perform user actions → call `get_render_report` to see results.

---

## get_render_report

Get the render profiling report. Shows hot components, unnecessary renders, and recent render details with trigger analysis.

#### Parameters

| Parameter  | Type                 | Required | Description     |
| ---------- | -------------------- | -------- | --------------- |
| `platform` | `"ios" \| "android"` | No       | Target platform |
| `deviceId` | `string`             | No       | Target device   |

#### Example

```json
// Request
{ "tool": "get_render_report" }

// Response
{
  "hotComponents": [
    { "component": "ProductCard", "renderCount": 24, "mountCount": 6 },
    { "component": "PriceLabel", "renderCount": 18, "mountCount": 6 }
  ],
  "unnecessaryRenders": [
    {
      "component": "Header",
      "count": 12,
      "message": "Header re-rendered 12 times without prop changes — wrap with React.memo"
    }
  ],
  "recentRenders": [
    {
      "component": "ProductCard",
      "timestamp": 1700000001234,
      "trigger": "parent",
      "changedProps": []
    }
  ]
}
```

#### Tips

- `hotComponents` are sorted by render count — the top entries are your optimization targets.
- `unnecessaryRenders` identifies components that re-rendered without prop changes — wrapping them in `React.memo` can prevent this.
- `trigger: "parent"` means the component re-rendered because its parent re-rendered, not because its own props changed.

---

## clear_render_profile

Stop render profiling and clear all collected data.

#### Parameters

| Parameter  | Type                 | Required | Description     |
| ---------- | -------------------- | -------- | --------------- |
| `platform` | `"ios" \| "android"` | No       | Target platform |
| `deviceId` | `string`             | No       | Target device   |

#### Example

```json
{ "tool": "clear_render_profile" }
```

#### Tips

- Call when you're done profiling to stop the overhead.
- Data is lost after clearing — save the `get_render_report` output first.
