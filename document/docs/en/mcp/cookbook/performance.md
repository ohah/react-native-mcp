# Performance Profiling

A step-by-step workflow for profiling React component renders, finding unnecessary re-renders, and identifying optimization targets.

## Scenario

Your product list screen feels sluggish when scrolling. You want to find which components are re-rendering too often and whether `React.memo` can help.

## Step 1: Start profiling

Begin render profiling, optionally filtering to specific components.

```json
{ "tool": "start_render_profile" }
```

Or focus on specific components:

```json
{
  "tool": "start_render_profile",
  "arguments": {
    "components": ["ProductCard", "PriceLabel", "ProductList", "Header"]
  }
}
```

## Step 2: Perform the problematic interaction

Scroll through the product list to trigger re-renders. Use `swipe` to simulate scrolling:

```json
{
  "tool": "swipe",
  "arguments": { "platform": "ios", "x1": 187, "y1": 600, "x2": 187, "y2": 200 }
}
```

Repeat a few times to accumulate render data:

```json
{
  "tool": "swipe",
  "arguments": { "platform": "ios", "x1": 187, "y1": 600, "x2": 187, "y2": 200 }
}
```

## Step 3: Get the render report

```json
{ "tool": "get_render_report" }
```

**Example response:**

```json
{
  "hotComponents": [
    { "component": "ProductCard", "renderCount": 48, "mountCount": 12 },
    { "component": "PriceLabel", "renderCount": 48, "mountCount": 12 },
    { "component": "Header", "renderCount": 6, "mountCount": 1 }
  ],
  "unnecessaryRenders": [
    {
      "component": "Header",
      "count": 5,
      "message": "Header re-rendered 5 times without prop changes — wrap with React.memo"
    },
    {
      "component": "PriceLabel",
      "count": 36,
      "message": "PriceLabel re-rendered 36 times without prop changes — wrap with React.memo"
    }
  ],
  "recentRenders": [
    { "component": "Header", "timestamp": 1700000001234, "trigger": "parent", "changedProps": [] },
    {
      "component": "ProductCard",
      "timestamp": 1700000001235,
      "trigger": "props",
      "changedProps": ["item"]
    }
  ]
}
```

## Step 4: Analyze the results

From the report:

1. **`Header`** re-rendered 5 times with no prop changes → triggered by parent re-renders → **wrap with `React.memo`**
2. **`PriceLabel`** re-rendered 36 times with no prop changes → also a `React.memo` candidate
3. **`ProductCard`** rendered 48 times total, 12 mounts — this is expected for a scrolling list with recycling

## Step 5: Verify after optimization

After applying `React.memo` to `Header` and `PriceLabel`, profile again:

```json
{ "tool": "clear", "arguments": { "target": "render_profile" } }
{ "tool": "start_render_profile" }
```

Repeat the same scroll interaction, then check results:

```json
{ "tool": "get_render_report" }
```

The `unnecessaryRenders` section should now be empty or significantly reduced for the optimized components.

## Step 6: Clean up

```json
{ "tool": "clear", "arguments": { "target": "render_profile" } }
```

## Summary

| Step | Tool                                                      | Purpose                             |
| ---- | --------------------------------------------------------- | ----------------------------------- |
| 1    | `start_render_profile`                                    | Begin tracking renders              |
| 2    | `swipe`                                                   | Trigger the problematic interaction |
| 3    | `get_render_report`                                       | Analyze render patterns             |
| 4    | —                                                         | Identify `React.memo` candidates    |
| 5    | `clear` (target: render_profile) + `start_render_profile` | Re-profile after optimization       |
| 6    | `clear` (target: render_profile)                          | Clean up                            |
