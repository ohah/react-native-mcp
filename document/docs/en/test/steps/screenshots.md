# Screenshots

Steps for capturing and comparing screenshots.

## screenshot

Save a screenshot.

#### Parameters

| Field | Type   | Required | Description                   |
| ----- | ------ | -------- | ----------------------------- |
| path  | string | No       | Save path. Default if omitted |

#### Example

```yaml
- screenshot:
    path: './results/step1.png'
```

---

## compareScreenshot

Compare the current screenshot against a baseline PNG image. Supports element-level cropping via selector for component-level visual regression testing.

#### Parameters

| Field       | Type    | Required | Description                                                                    |
| ----------- | ------- | -------- | ------------------------------------------------------------------------------ |
| baseline    | string  | Yes      | Path to baseline PNG (relative to YAML file)                                   |
| selector    | string  | No       | CSS-like selector to crop a specific element. If omitted, compares full screen |
| threshold   | number  | No       | pixelmatch threshold (0–1). Default 0.01                                       |
| update      | boolean | No       | If true, save current screenshot as new baseline (skip comparison)             |
| saveDiff    | string  | No       | Custom path for diff image (relative to output dir)                            |
| saveCurrent | string  | No       | Save current screenshot to this path (relative to output dir)                  |

#### Example

```yaml
# Full screen comparison
- compareScreenshot:
    baseline: ./baselines/home-screen.png
    threshold: 0.01

# Component-level comparison
- compareScreenshot:
    baseline: ./baselines/counter-button.png
    selector: 'Pressable:text("Count:")'
    threshold: 0.005

# Update baseline (save current as new baseline)
- compareScreenshot:
    baseline: ./baselines/home-screen.png
    update: true
```

#### Tips

1. Run with `update: true` to create baselines, then commit to Git.
2. Run without `update` to compare current state against baselines.
3. On failure, a diff image is saved to the output directory. The HTML reporter shows the diff inline.
