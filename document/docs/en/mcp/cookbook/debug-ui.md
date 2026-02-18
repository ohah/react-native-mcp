# UI Debugging

A step-by-step workflow for diagnosing UI issues using component tree inspection, element queries, and state inspection.

## Scenario

A user reports that the "Add to Cart" button on the product detail screen doesn't respond. Let's investigate.

## Step 1: Take a snapshot

Start by capturing the component tree to understand the current screen structure.

```json
{ "tool": "take_snapshot", "arguments": { "maxDepth": 15 } }
```

This returns the full component tree with UIDs, types, testIDs, and text content. Look for the button in the tree output.

## Step 2: Find the button

Use `query_selector` to locate the button element and get its measurements.

```json
{ "tool": "query_selector", "arguments": { "selector": ":text(\"Add to Cart\")" } }
```

**Example response:**

```json
{
  "uid": "add-to-cart-btn",
  "type": "Pressable",
  "measure": { "pageX": 20, "pageY": 680, "width": 335, "height": 48 }
}
```

If the button is found, check:

- Is it positioned off-screen? (`pageY` beyond screen height)
- Does it have zero dimensions? (`width: 0` or `height: 0`)
- Is it overlapped by another element?

## Step 3: Check for overlapping elements

If the button exists but doesn't respond to taps, something might be covering it. Query for elements at the same position.

```json
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "() => measureView('add-to-cart-btn')"
  }
}
```

Then use `describe_ui` to check the native accessibility tree at that point:

```json
{
  "tool": "describe_ui",
  "arguments": { "platform": "ios", "mode": "point", "x": 187, "y": 704 }
}
```

## Step 4: Inspect component state

Check the component's internal state to see if it's disabled or in a loading state.

```json
{
  "tool": "inspect_state",
  "arguments": { "selector": "#add-to-cart-btn" }
}
```

**Example response:**

```json
{
  "component": "AddToCartButton",
  "hooks": [
    { "index": 0, "type": "useState", "value": true },
    { "index": 1, "type": "useState", "value": "out_of_stock" }
  ]
}
```

Found it — hook index 1 shows `"out_of_stock"`, which likely disables the button.

## Step 5: Track state changes

Monitor state changes while interacting with the app to understand the flow.

```json
{ "tool": "clear_state_changes" }
```

Now interact with the app (navigate, tap, etc.), then check what changed:

```json
{
  "tool": "get_state_changes",
  "arguments": { "component": "AddToCartButton", "limit": 10 }
}
```

## Step 6: Check console for errors

Look for related error messages in the console.

```json
{
  "tool": "list_console_messages",
  "arguments": { "level": "error", "limit": 10 }
}
```

## Summary

| Step | Tool                    | Purpose                                |
| ---- | ----------------------- | -------------------------------------- |
| 1    | `take_snapshot`         | Get component tree overview            |
| 2    | `query_selector`        | Find specific element + measurements   |
| 3    | `describe_ui`           | Check native view hierarchy at a point |
| 4    | `inspect_state`         | Examine React state hooks              |
| 5    | `get_state_changes`     | Track state changes over time          |
| 6    | `list_console_messages` | Check for error logs                   |
