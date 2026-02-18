# Assertions

Tools for verifying text content, element visibility, and element count. All assertions support polling with `timeoutMs` for async UI updates.

## assert_text

Assert that text exists on the screen.

#### Parameters

| Parameter    | Type                 | Required | Description                                                                              |
| ------------ | -------------------- | -------- | ---------------------------------------------------------------------------------------- |
| `text`       | `string`             | **Yes**  | Text substring to assert exists                                                          |
| `selector`   | `string`             | No       | Selector to narrow the search scope                                                      |
| `timeoutMs`  | `number`             | No       | Max wait time in ms. `0` = single check, `>0` = poll until pass or timeout. Default: `0` |
| `intervalMs` | `number`             | No       | Poll interval in ms (used only when `timeoutMs > 0`). Default: `300`                     |
| `platform`   | `"ios" \| "android"` | No       | Target platform                                                                          |
| `deviceId`   | `string`             | No       | Target device                                                                            |

#### Example

```json
// Simple text check
{ "tool": "assert_text", "arguments": { "text": "Welcome" } }

// Scoped text check
{ "tool": "assert_text", "arguments": { "text": "Error", "selector": "#error-banner" } }

// Poll until text appears (max 5 seconds)
{ "tool": "assert_text", "arguments": { "text": "Order confirmed", "timeoutMs": 5000 } }

// Response
{ "pass": true, "message": "Text \"Welcome\" found on screen" }
```

#### Tips

- Matches by **substring** — `"Welcome"` will match `"Welcome back, John"`.
- Use `selector` to avoid false positives when the same text appears in multiple places.
- Use `timeoutMs` for elements that appear after async operations (API calls, animations, etc.).

---

## assert_visible

Assert that an element matching a selector is visible on screen.

#### Parameters

| Parameter    | Type                 | Required | Description                         |
| ------------ | -------------------- | -------- | ----------------------------------- |
| `selector`   | `string`             | **Yes**  | Selector to check visibility        |
| `timeoutMs`  | `number`             | No       | Max wait time in ms. Default: `0`   |
| `intervalMs` | `number`             | No       | Poll interval in ms. Default: `300` |
| `platform`   | `"ios" \| "android"` | No       | Target platform                     |
| `deviceId`   | `string`             | No       | Target device                       |

#### Example

```json
// Check if loading spinner is visible
{ "tool": "assert_visible", "arguments": { "selector": "#loading-spinner" } }

// Wait for modal to appear
{
  "tool": "assert_visible",
  "arguments": { "selector": "#confirmation-modal", "timeoutMs": 3000 }
}

// Response
{ "pass": true, "message": "Element matching '#confirmation-modal' is visible" }
```

#### Tips

- Queries the React Fiber tree, not the native view hierarchy.
- An element is "visible" if it exists in the tree and has non-zero dimensions.

---

## assert_not_visible

Assert that an element matching a selector is **not** visible. Useful for verifying that modals, toasts, or loading indicators have disappeared.

#### Parameters

| Parameter    | Type                 | Required | Description                                      |
| ------------ | -------------------- | -------- | ------------------------------------------------ |
| `selector`   | `string`             | **Yes**  | Selector of the element that must not be visible |
| `timeoutMs`  | `number`             | No       | Max wait time in ms. Default: `0`                |
| `intervalMs` | `number`             | No       | Poll interval in ms. Default: `300`              |
| `platform`   | `"ios" \| "android"` | No       | Target platform                                  |
| `deviceId`   | `string`             | No       | Target device                                    |

#### Example

```json
// Verify loading spinner disappeared
{
  "tool": "assert_not_visible",
  "arguments": { "selector": "#loading-spinner", "timeoutMs": 5000 }
}

// Response
{ "pass": true, "message": "Element matching '#loading-spinner' is not visible" }
```

#### Tips

- Use `timeoutMs` to wait for disappearing animations or async operations to complete.
- Passes if the element does not exist in the tree **or** has zero dimensions.

---

## assert_element_count

Assert the number of elements matching a selector. Supports exact count or min/max range.

#### Parameters

| Parameter       | Type                 | Required | Description                                                         |
| --------------- | -------------------- | -------- | ------------------------------------------------------------------- |
| `selector`      | `string`             | **Yes**  | Selector to count matching elements                                 |
| `expectedCount` | `number`             | No       | Exact count expected. Mutually exclusive with `minCount`/`maxCount` |
| `minCount`      | `number`             | No       | Minimum count (inclusive)                                           |
| `maxCount`      | `number`             | No       | Maximum count (inclusive)                                           |
| `timeoutMs`     | `number`             | No       | Max wait time in ms. Default: `0`                                   |
| `intervalMs`    | `number`             | No       | Poll interval in ms. Default: `300`                                 |
| `platform`      | `"ios" \| "android"` | No       | Target platform                                                     |
| `deviceId`      | `string`             | No       | Target device                                                       |

#### Example

```json
// Exactly 3 items
{
  "tool": "assert_element_count",
  "arguments": { "selector": ".list-item", "expectedCount": 3 }
}

// At least 1 item
{
  "tool": "assert_element_count",
  "arguments": { "selector": "#cart-item", "minCount": 1 }
}

// Between 2 and 5 items
{
  "tool": "assert_element_count",
  "arguments": { "selector": "#notification", "minCount": 2, "maxCount": 5 }
}

// Response
{ "pass": true, "actualCount": 3, "message": "Found 3 elements matching '.list-item' (expected 3)" }
```

#### Tips

- Use `expectedCount` for exact matches, `minCount`/`maxCount` for range checks.
- `expectedCount` and `minCount`/`maxCount` are mutually exclusive — do not combine them.
