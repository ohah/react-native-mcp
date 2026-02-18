# Screen Capture

Tools for capturing screenshots, component tree snapshots, querying native UI trees, and performing visual regression testing.

## take_screenshot

Capture the device/simulator screen as a JPEG image (720p).

#### Parameters

| Parameter  | Type                 | Required | Description                                              |
| ---------- | -------------------- | -------- | -------------------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | `android`: uses adb. `ios`: uses simctl (simulator only) |
| `filePath` | `string`             | No       | Path to save the screenshot file                         |

#### Example

```json
// Request
{ "tool": "take_screenshot", "arguments": { "platform": "ios" } }
```

#### Tips

- Returns base64 JPEG and point size metadata for coordinate conversion.
- Prefer `assert_text` or `assert_visible` over screenshots when possible — screenshots consume vision tokens.
- iOS only supports simulators, not physical devices.

---

## take_snapshot

Capture the React Native component tree. Returns UIDs, types, testIDs, and text content.

#### Parameters

| Parameter  | Type                 | Required | Description                         |
| ---------- | -------------------- | -------- | ----------------------------------- |
| `platform` | `"ios" \| "android"` | No       | Target platform                     |
| `deviceId` | `string`             | No       | Target device                       |
| `maxDepth` | `number`             | No       | Max tree depth (1–100). Default: 30 |

#### Example

```json
// Request
{ "tool": "take_snapshot", "arguments": { "maxDepth": 10 } }

// Response (abbreviated)
{
  "tree": {
    "uid": "RCTView:0",
    "type": "View",
    "children": [
      {
        "uid": "header",
        "type": "View",
        "testID": "header",
        "children": [
          { "uid": "header>Text:0", "type": "Text", "text": "Home" }
        ]
      }
    ]
  }
}
```

#### Tips

- Use `uid` values with `measureView(uid)` via `evaluate_script` to get exact coordinates.
- Reduce `maxDepth` for large component trees to limit output size.
- The snapshot traverses the React Fiber tree, not the native view hierarchy.

---

## describe_ui

Query the native UI/accessibility tree. Returns the full native hierarchy.

#### Parameters

| Parameter  | Type                 | Required | Description                                                                            |
| ---------- | -------------------- | -------- | -------------------------------------------------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform                                                                        |
| `mode`     | `"all" \| "point"`   | No       | iOS: `all` dumps full tree, `point` queries at (x,y). Android: ignored. Default: `all` |
| `x`        | `number`             | No       | X in points. Required for iOS `mode=point`                                             |
| `y`        | `number`             | No       | Y in points. Required for iOS `mode=point`                                             |
| `nested`   | `boolean`            | No       | iOS: return hierarchical tree. Android: ignored. Default: `false`                      |
| `deviceId` | `string`             | No       | Device ID                                                                              |

#### Example

```json
// Request — iOS point query
{
  "tool": "describe_ui",
  "arguments": { "platform": "ios", "mode": "point", "x": 200, "y": 400 }
}
```

#### Tips

- Produces a large payload. Prefer `query_selector` for querying React Native elements.
- iOS uses `idb ui describe-all/describe-point`. Android uses `uiautomator dump`.
- Useful for inspecting native components that aren't part of the React tree (e.g., native alerts, system UI).

---

## visual_compare

Compare the current screen against a baseline PNG for visual regression testing.

#### Parameters

| Parameter        | Type                 | Required | Description                                                          |
| ---------------- | -------------------- | -------- | -------------------------------------------------------------------- |
| `platform`       | `"ios" \| "android"` | **Yes**  | Target platform                                                      |
| `baseline`       | `string`             | **Yes**  | Absolute path to the baseline PNG file                               |
| `selector`       | `string`             | No       | Selector to crop a specific element. Omit for full-screen comparison |
| `threshold`      | `number`             | No       | pixelmatch threshold (0–1). Default: `0.1`                           |
| `updateBaseline` | `boolean`            | No       | If `true`, save current screenshot as new baseline (skip comparison) |
| `saveDiff`       | `string`             | No       | Path to save the diff image PNG                                      |
| `saveCurrent`    | `string`             | No       | Path to save the current screenshot PNG                              |
| `deviceId`       | `string`             | No       | Device ID                                                            |

#### Example

```json
// Create baseline
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "updateBaseline": true
  }
}

// Compare against baseline
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "saveDiff": "/tmp/diffs/home-diff.png",
    "threshold": 0.05
  }
}

// Response
{
  "pass": false,
  "diffRatio": 0.023,
  "diffPixels": 4821,
  "totalPixels": 209664,
  "threshold": 0.05,
  "message": "Visual difference detected: 2.3% of pixels differ"
}
```

#### Tips

- Use `updateBaseline: true` to create initial baselines.
- Use `selector` to compare only a specific component (e.g., `#header`) instead of the full screen.
- Lower `threshold` values are stricter (0 = pixel-perfect, 1 = any difference passes).
- Uses [sharp](https://sharp.pixelplumbing.com/) + [pixelmatch](https://github.com/mapbox/pixelmatch) internally.
