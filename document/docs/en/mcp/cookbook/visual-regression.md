# Visual Regression Testing

A step-by-step workflow for creating visual baselines, detecting UI changes, and comparing element-level screenshots.

## Scenario

You want to ensure that a refactoring doesn't accidentally change the appearance of your screens.

## Step 1: Create baselines

Save the current state of each screen as a baseline image.

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "updateBaseline": true
  }
}
```

Navigate to another screen and create its baseline:

```json
{
  "tool": "open_deeplink",
  "arguments": { "platform": "ios", "url": "myapp://profile" }
}

{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/profile.png",
    "updateBaseline": true
  }
}
```

## Step 2: Create element-level baselines

For more focused testing, create baselines for specific components using a selector.

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/header.png",
    "selector": "#header",
    "updateBaseline": true
  }
}
```

## Step 3: Make your changes

Apply your refactoring or code changes, then rebuild and reload the app.

## Step 4: Compare against baselines

Run comparisons against the saved baselines.

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "saveDiff": "/tmp/diffs/home-diff.png",
    "saveCurrent": "/tmp/diffs/home-current.png"
  }
}
```

**Example response (no changes):**

```json
{
  "pass": true,
  "diffRatio": 0.001,
  "diffPixels": 209,
  "totalPixels": 209664,
  "threshold": 0.1,
  "message": "Visual comparison passed: 0.1% of pixels differ"
}
```

**Example response (changes detected):**

```json
{
  "pass": false,
  "diffRatio": 0.087,
  "diffPixels": 18240,
  "totalPixels": 209664,
  "threshold": 0.1,
  "message": "Visual difference detected: 8.7% of pixels differ"
}
```

## Step 5: Review the diff

When a comparison fails, check the saved diff image to see exactly what changed. The diff image highlights changed pixels in red.

```json
{
  "tool": "take_screenshot",
  "arguments": { "platform": "ios", "filePath": "/tmp/diffs/home-current.png" }
}
```

## Step 6: Adjust threshold if needed

If minor rendering differences (anti-aliasing, font rendering) cause false positives, increase the threshold:

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "threshold": 0.2
  }
}
```

For pixel-perfect comparisons, lower the threshold:

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "threshold": 0.01
  }
}
```

## Step 7: Update baselines after intentional changes

If the visual changes are intentional, update the baseline:

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "updateBaseline": true
  }
}
```

## Summary

| Step | Tool                                         | Purpose                        |
| ---- | -------------------------------------------- | ------------------------------ |
| 1    | `visual_compare` (updateBaseline)            | Create full-screen baselines   |
| 2    | `visual_compare` (selector + updateBaseline) | Create element-level baselines |
| 3    | —                                            | Make code changes              |
| 4    | `visual_compare` (saveDiff)                  | Compare and generate diff      |
| 5    | `take_screenshot`                            | Review current state           |
| 6    | `visual_compare` (threshold)                 | Adjust sensitivity             |
| 7    | `visual_compare` (updateBaseline)            | Accept intentional changes     |
