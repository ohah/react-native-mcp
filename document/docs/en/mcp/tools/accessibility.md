# Accessibility

Automated accessibility audit tool for React Native apps.

## accessibility_audit

Run an accessibility audit on the React Native component tree. Returns violations with severity, rule name, and actionable messages.

#### Parameters

| Parameter  | Type                 | Required | Description                                     |
| ---------- | -------------------- | -------- | ----------------------------------------------- |
| `maxDepth` | `number`             | No       | Max tree depth to audit (1–100). Default: `999` |
| `platform` | `"ios" \| "android"` | No       | Target platform                                 |
| `deviceId` | `string`             | No       | Target device                                   |

#### Rules

| Rule                    | Severity | Description                                               |
| ----------------------- | -------- | --------------------------------------------------------- |
| `pressable-needs-label` | error    | Pressable elements must have an accessibility label       |
| `image-needs-alt`       | error    | Images must have alt text (`accessibilityLabel` or `alt`) |
| `touch-target-size`     | warning  | Touch targets should be at least 44×44 points             |
| `missing-role`          | warning  | Interactive elements should have an `accessibilityRole`   |

#### Example

```json
// Run audit
{ "tool": "accessibility_audit" }

// Response
{
  "violations": [
    {
      "rule": "pressable-needs-label",
      "severity": "error",
      "selector": "#close-btn",
      "message": "Pressable at #close-btn has no accessibilityLabel"
    },
    {
      "rule": "touch-target-size",
      "severity": "warning",
      "selector": "#small-link",
      "message": "Touch target at #small-link is 32×28 points (minimum: 44×44)"
    },
    {
      "rule": "image-needs-alt",
      "severity": "error",
      "selector": "Image:nth-of-type(3)",
      "message": "Image has no accessibilityLabel or alt prop"
    }
  ],
  "summary": {
    "errors": 2,
    "warnings": 1,
    "passes": 45
  }
}
```

#### Tips

- Run this on every screen during development to catch accessibility issues early.
- The audit traverses the React Fiber tree, so it checks React Native components — not native views.
- Focus on fixing `error` severity issues first (screen reader users cannot use unlabeled controls).
- After fixing violations, re-run the audit to confirm they're resolved.
