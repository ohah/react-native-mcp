# Accessibility Audit

A step-by-step workflow for running accessibility audits, identifying violations, and verifying fixes.

## Scenario

You want to ensure your app meets basic accessibility standards before release — all interactive elements have labels, images have alt text, and touch targets are large enough.

## Step 1: Run the initial audit

```json
{ "tool": "accessibility_audit" }
```

**Example response:**

```json
{
  "violations": [
    {
      "rule": "pressable-needs-label",
      "severity": "error",
      "selector": "#close-btn",
      "message": "Pressable at #close-btn has no accessibilityLabel"
    },
    {
      "rule": "image-needs-alt",
      "severity": "error",
      "selector": "#avatar-image",
      "message": "Image at #avatar-image has no accessibilityLabel or alt prop"
    },
    {
      "rule": "touch-target-size",
      "severity": "warning",
      "selector": "#help-link",
      "message": "Touch target at #help-link is 32×28 points (minimum: 44×44)"
    },
    {
      "rule": "missing-role",
      "severity": "warning",
      "selector": "#tab-home",
      "message": "Interactive element at #tab-home has no accessibilityRole"
    }
  ],
  "summary": { "errors": 2, "warnings": 2, "passes": 38 }
}
```

## Step 2: Prioritize fixes

Focus on **errors** first — they affect screen reader users the most:

1. `pressable-needs-label` on `#close-btn` — add `accessibilityLabel="Close"`
2. `image-needs-alt` on `#avatar-image` — add `accessibilityLabel="User avatar"`

Then address **warnings**:

3. `touch-target-size` on `#help-link` — increase padding or `minWidth`/`minHeight` to 44pt
4. `missing-role` on `#tab-home` — add `accessibilityRole="tab"`

## Step 3: Inspect a specific element

Get more details about a flagged element:

```json
{
  "tool": "query_selector",
  "arguments": { "selector": "#close-btn" }
}
```

**Response:**

```json
{
  "uid": "close-btn",
  "type": "Pressable",
  "measure": { "pageX": 330, "pageY": 50, "width": 30, "height": 30 }
}
```

This confirms the close button is only 30×30 points — also a `touch-target-size` issue.

## Step 4: Fix the code

Apply the fixes in your source code:

```jsx
// Before
<Pressable testID="close-btn" onPress={onClose}>
  <Icon name="close" />
</Pressable>

// After
<Pressable
  testID="close-btn"
  onPress={onClose}
  accessibilityLabel="Close"
  accessibilityRole="button"
  style={{ minWidth: 44, minHeight: 44 }}
>
  <Icon name="close" />
</Pressable>
```

## Step 5: Re-run the audit

After fixing and reloading the app, run the audit again:

```json
{ "tool": "accessibility_audit" }
```

**Expected response:**

```json
{
  "violations": [],
  "summary": { "errors": 0, "warnings": 0, "passes": 42 }
}
```

## Step 6: Audit other screens

Navigate to each screen and repeat the audit:

```json
{
  "tool": "open_deeplink",
  "arguments": { "platform": "ios", "url": "myapp://settings" }
}

{ "tool": "accessibility_audit" }
```

## Summary

| Step | Tool                                    | Purpose                         |
| ---- | --------------------------------------- | ------------------------------- |
| 1    | `accessibility_audit`                   | Run initial audit               |
| 2    | —                                       | Prioritize errors over warnings |
| 3    | `query_selector`                        | Inspect flagged elements        |
| 4    | —                                       | Fix code (labels, roles, sizes) |
| 5    | `accessibility_audit`                   | Verify all violations resolved  |
| 6    | `open_deeplink` + `accessibility_audit` | Audit remaining screens         |
