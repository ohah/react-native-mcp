# Steps Reference

The E2E YAML runner supports **33 step types** across 7 categories. Each step performs a single action — tap, assert, wait, navigate, etc.

## Step syntax

Use **exactly one** key per step entry. Most steps take an object of parameters; a few (`wait`, `launch`, `terminate`, `clearState`) take a single scalar value.

```yaml
# Object-style
- tap:
    selector: '#submit-button'

# Scalar-style
- wait: 500
```

## Selector syntax

Steps that accept a `selector` field use the same query syntax as MCP tools:

| Pattern     | Example                        | Description                |
| ----------- | ------------------------------ | -------------------------- |
| testID      | `#submit-btn`                  | Match by testID prop       |
| Type        | `Text`                         | Match by component type    |
| Text        | `:text("Hello")`               | Match by text content      |
| Attribute   | `[accessibilityLabel="Close"]` | Match by prop value        |
| displayName | `:display-name("MyComponent")` | Match by display name      |
| Index       | `:nth-of-type(2)`              | Match Nth element of type  |
| Capability  | `:has-press`                   | Pressable elements         |
| Hierarchy   | `ScrollView > View > Text`     | Direct child or descendant |
| OR          | `#btn-a, #btn-b`               | Match either selector      |

## Categories

| Category                            | Steps | Description                                          |
| ----------------------------------- | ----- | ---------------------------------------------------- |
| [Interaction](./interaction)        | 8     | Tap, swipe, type, long press, double tap, scroll     |
| [Assertions](./assertions)          | 6     | Verify text, visibility, element count, value        |
| [Waits](./waits)                    | 4     | Wait for text, visibility, or fixed delay            |
| [Navigation & Device](./navigation) | 7     | Press button, back, home, deep link, location, reset |
| [App Lifecycle](./lifecycle)        | 2     | Launch and terminate apps                            |
| [Screenshots](./screenshots)        | 2     | Capture and compare screenshots                      |
| [Utilities](./utilities)            | 4     | Copy/paste text, run JS, add media                   |
