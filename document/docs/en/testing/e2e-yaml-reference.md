# E2E YAML Reference

Reference for the YAML scenario syntax used by the `react-native-mcp-test` runner. One test suite per file.

## File structure

```yaml
name: string # Suite name (required)
config: # Config (required)
  platform: ios | android
  timeout?: number # ms, connection wait, etc.
  bundleId?: string # App bundle/package ID
  deviceId?: string # idb/adb device ID (optional)
  orientation?: number # iOS GraphicsOrientation override (1-4, optional)
setup?: Step[] # Run before main steps (optional)
steps: Step[] # Main test steps (required, 1+)
teardown?: Step[] # Run on exit (optional)
```

- `config.platform`: `ios` | `android`. Can be overridden by CLI `-p`.
- `config.bundleId`: e.g. `org.example.app` (iOS), `com.example.app` (Android). Runner starts the app after the server is up.
- `config.orientation`: iOS only. Force a GraphicsOrientation value (1=Portrait, 2=Portrait180, 3=LandscapeA, 4=LandscapeB). Omit for auto-detection via `xcrun simctl spawn`.
- `setup` / `teardown`: Each is `Step[]`. `teardown` runs even when a step fails.

---

## Step types

Use **exactly one** of the keys below. `selector` follows MCP selector syntax (e.g. `#testID`, `Text:text("label")`).

### tap

Tap the element once.

- **iOS**: All 4 orientations supported (Portrait, Portrait180, LandscapeA, LandscapeB). Auto-detected via `xcrun simctl spawn` or forced with `config.orientation`.
- **Android**: No orientation correction needed; verified working.

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | ✓        | Element selector |

```yaml
- tap:
    selector: '#submit-button'
```

---

### swipe

Swipe on the element.

| Field     | Type             | Required | Description                                                                                           |
| --------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| selector  | string           | ✓        | Target element selector                                                                               |
| direction | string           | ✓        | `up` \| `down` \| `left` \| `right`                                                                   |
| distance  | number \| string |          | Swipe distance. Number for dp, string like `'50%'` for percentage of element size. Default if omitted |

```yaml
- swipe:
    selector: '#list'
    direction: up
    distance: 200 # absolute 200dp
- swipe:
    selector: '#carousel'
    direction: left
    distance: '80%' # 80% of element width
```

---

### typeText

Type text into the element (replaces existing content).

| Field    | Type   | Required | Description           |
| -------- | ------ | -------- | --------------------- |
| selector | string | ✓        | Input target selector |
| text     | string | ✓        | String to type        |

```yaml
- typeText:
    selector: '#email'
    text: user@example.com
```

---

### inputText

Type text into the currently focused field.

| Field | Type   | Required | Description    |
| ----- | ------ | -------- | -------------- |
| text  | string | ✓        | String to type |

```yaml
- inputText:
    text: Hello
```

---

### pressButton

Press a hardware or software button.

| Field  | Type   | Required | Description                     |
| ------ | ------ | -------- | ------------------------------- |
| button | string | ✓        | Button id (e.g. `home`, `back`) |

```yaml
- pressButton:
    button: back
```

---

### waitForText

Wait until the given text appears.

| Field    | Type   | Required | Description                        |
| -------- | ------ | -------- | ---------------------------------- |
| text     | string | ✓        | Expected text                      |
| timeout  | number |          | Wait time (ms). Default if omitted |
| selector | string |          | Scope selector for text            |

```yaml
- waitForText:
    text: 'Count: 1'
    timeout: 3000
    selector: '#counter'
```

---

### waitForVisible

Wait until the element is visible.

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | ✓        | Element selector |
| timeout  | number |          | Wait time (ms)   |

```yaml
- waitForVisible:
    selector: '#loaded-view'
    timeout: 5000
```

---

### waitForNotVisible

Wait until the element is not visible.

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | ✓        | Element selector |
| timeout  | number |          | Wait time (ms)   |

```yaml
- waitForNotVisible:
    selector: '#spinner'
    timeout: 3000
```

---

### assertText

Assert that the text is present (within the element when selector is given). Fails the step on mismatch.

| Field    | Type   | Required | Description    |
| -------- | ------ | -------- | -------------- |
| text     | string | ✓        | Expected text  |
| selector | string |          | Scope selector |

```yaml
- assertText:
    text: 'Saved'
    selector: '#status'
```

---

### assertVisible

Assert that the element is visible.

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | ✓        | Element selector |

```yaml
- assertVisible:
    selector: '#main-form'
```

---

### assertNotVisible

Assert that the element is not visible.

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | ✓        | Element selector |

```yaml
- assertNotVisible:
    selector: '#error-banner'
```

---

### assertCount

Assert that the number of elements matching the selector equals the expected count.

| Field    | Type   | Required | Description       |
| -------- | ------ | -------- | ----------------- |
| selector | string | ✓        | Selector to count |
| count    | number | ✓        | Expected count    |

```yaml
- assertCount:
    selector: ':has-press'
    count: 5
```

---

### screenshot

Save a screenshot.

| Field | Type   | Required | Description                   |
| ----- | ------ | -------- | ----------------------------- |
| path  | string |          | Save path. Default if omitted |

```yaml
- screenshot:
    path: './results/step1.png'
```

---

### compareScreenshot

Compare the current screenshot against a baseline PNG image. Supports element-level cropping via selector for component-level visual regression testing.

| Field     | Type    | Required | Description                                                                    |
| --------- | ------- | -------- | ------------------------------------------------------------------------------ |
| baseline  | string  | ✓        | Path to baseline PNG (relative to YAML file)                                   |
| selector  | string  |          | CSS-like selector to crop a specific element. If omitted, compares full screen |
| threshold | number  |          | pixelmatch threshold (0–1). Default 0.01                                       |
| update    | boolean |          | If true, save current screenshot as new baseline (skip comparison)             |

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

**Workflow:**

1. Run with `update: true` to create baselines → commit to Git.
2. Run without `update` to compare current state against baselines.
3. On failure, a diff image is saved to the output directory. The HTML reporter shows the diff inline.

---

### wait

Fixed delay in ms.

| Field   | Type   | Required | Description                                |
| ------- | ------ | -------- | ------------------------------------------ |
| (value) | number | ✓        | Delay in ms. This step is a single number. |

```yaml
- wait: 500
```

---

### launch

Launch the app. Usually used in `setup`.

| Field   | Type   | Required | Description                                      |
| ------- | ------ | -------- | ------------------------------------------------ |
| (value) | string | ✓        | Bundle/package ID. This step is a single string. |

```yaml
- launch: org.reactnativemcp.demo
```

---

### terminate

Terminate the app. Usually used in `teardown`.

| Field   | Type   | Required | Description       |
| ------- | ------ | -------- | ----------------- |
| (value) | string | ✓        | Bundle/package ID |

```yaml
- terminate: org.reactnativemcp.demo
```

---

### openDeepLink

Open a deep link.

| Field | Type   | Required | Description   |
| ----- | ------ | -------- | ------------- |
| url   | string | ✓        | Deep link URL |

```yaml
- openDeepLink:
    url: myapp://screen/settings
```

---

### clearState

Clear app data or reset permissions. **Behavior differs by platform** — see "Platform differences and limitations" below.

| Field   | Type   | Required | Description                       |
| ------- | ------ | -------- | --------------------------------- |
| (value) | string | ✓        | iOS: bundle ID. Android: package. |

```yaml
- clearState: org.reactnativemcp.demo
```

---

### setLocation

Set GPS location on the simulator (iOS) or emulator (Android). **Not supported on Android physical devices.**

| Field     | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| latitude  | number | ✓        | Latitude (-90–90)    |
| longitude | number | ✓        | Longitude (-180–180) |

```yaml
- setLocation:
    latitude: 37.5665
    longitude: 126.978
```

---

### copyText

Read the text of the element matching the selector and store it in the **app client internal clipboard** (OS clipboard is not used). Use with `pasteText`.

| Field    | Type   | Required | Description          |
| -------- | ------ | -------- | -------------------- |
| selector | string | ✓        | Element to read from |

```yaml
- copyText:
    selector: '#invite-code'
```

---

### pasteText

Paste the content stored by `copyText` into the currently focused input via `input_text`. Reuses idb/adb input flow on both platforms.

No parameters.

```yaml
- pasteText:
```

---

### evaluate

Run JavaScript in the app context.

| Field  | Type   | Required | Description    |
| ------ | ------ | -------- | -------------- |
| script | string | ✓        | JS code to run |

```yaml
- evaluate:
    script: 'global.__testFlag = true;'
```

---

### back

Press the back button. Shorthand for `pressButton: { button: BACK }`.

No parameters.

```yaml
- back:
```

---

### home

Press the home button. Shorthand for `pressButton: { button: HOME }`.

No parameters.

```yaml
- home:
```

---

### hideKeyboard

Dismiss the keyboard. Sends Escape key (HID 41) on iOS and BACK on Android.

No parameters.

```yaml
- hideKeyboard:
```

---

### longPress

Long-press an element. Wraps `tap` + `duration` for readability.

| Field    | Type   | Required | Description                      |
| -------- | ------ | -------- | -------------------------------- |
| selector | string | ✓        | Element to long-press            |
| duration | number |          | Press duration (ms). Default 800 |

```yaml
- longPress:
    selector: '#item-3'
    duration: 1000
```

---

### addMedia

Add media files (images, videos) to the device gallery.

| Field | Type     | Required | Description                            |
| ----- | -------- | -------- | -------------------------------------- |
| paths | string[] | ✓        | Array of local file paths (min 1 item) |

```yaml
- addMedia:
    paths: ['/tmp/photo.jpg', '/tmp/video.mp4']
```

---

### assertHasText

Assert that the text is present (within the element when selector is given). Alias for `assertText`.

| Field    | Type   | Required | Description    |
| -------- | ------ | -------- | -------------- |
| text     | string | ✓        | Expected text  |
| selector | string |          | Scope selector |

```yaml
- assertHasText:
    text: 'Total: $12.00'
    selector: '#price-label'
```

---

### clearText

Clear all text from a TextInput.

| Field    | Type   | Required | Description               |
| -------- | ------ | -------- | ------------------------- |
| selector | string | ✓        | Target TextInput selector |

```yaml
- clearText:
    selector: '#email'
```

---

### doubleTap

Double-tap the element.

| Field    | Type   | Required | Description                         |
| -------- | ------ | -------- | ----------------------------------- |
| selector | string | ✓        | Element selector                    |
| interval | number |          | Delay between taps (ms). Default 50 |

```yaml
- doubleTap:
    selector: '#zoomable-image'
    interval: 100
```

---

### assertValue

Assert that the element's `value` prop matches the expected string.

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | ✓        | Element selector |
| expected | string | ✓        | Expected value   |

```yaml
- assertValue:
    selector: '#quantity-input'
    expected: '3'
```

---

### scrollUntilVisible

Scroll until the element is visible (repeat up to limit).

| Field      | Type   | Required | Description                         |
| ---------- | ------ | -------- | ----------------------------------- |
| selector   | string | ✓        | Element to make visible             |
| direction  | string |          | `up` \| `down` \| `left` \| `right` |
| maxScrolls | number |          | Max scrolls. Fails if exceeded      |

```yaml
- scrollUntilVisible:
    selector: '#footer'
    direction: down
    maxScrolls: 10
```

---

## clearState / setLocation / copyText·pasteText — Platform differences and limitations

| Step            | iOS                  | Android           | Notes                                                                                                                                                                                                                                                        |
| --------------- | -------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **clearState**  | ✓ (permissions only) | ✓ (full)          | **iOS**: `simctl privacy reset all` — resets permissions/privacy only; app sandbox (documents, caches) is **not** cleared. Full reset requires uninstall + reinstall. **Android**: `pm clear` — clears all app data (AsyncStorage, SharedPreferences, etc.). |
| **setLocation** | ✓                    | ✓ (emulator only) | **iOS**: All simulators supported (`idb set-location`). **Android**: **Emulator only**. `adb emu geo fix` does not work on physical devices. Use a mock location app or similar on real devices.                                                             |
| **copyText**    | ✓                    | ✓                 | Platform-agnostic. Stores text in app client internal variable; OS clipboard is not used.                                                                                                                                                                    |
| **pasteText**   | ✓                    | ✓                 | Pastes internal clipboard via `input_text`. Reuses idb (iOS) / adb (Android) input flow. Subject to same Unicode/keyboard limits as `input_text`.                                                                                                            |

---

## Full example

```yaml
name: Login flow
config:
  platform: ios
  timeout: 10000
  bundleId: org.example.app
  # orientation: 3  # Force iOS landscape (optional)

setup:
  - launch: org.example.app
  - waitForVisible:
      selector: '#login-screen'
      timeout: 5000

steps:
  - typeText:
      selector: '#email'
      text: test@example.com
  - hideKeyboard:
  - typeText:
      selector: '#password'
      text: secret
  - tap:
      selector: '#login-button'
  - waitForText:
      text: 'Home'
      timeout: 5000
  - assertHasText:
      text: 'Welcome'
      selector: '#greeting'
  - longPress:
      selector: '#profile-item'
      duration: 1000
  - screenshot:
      path: ./results/login-success.png
  - back:

teardown:
  - terminate: org.example.app
```

## E2E CLI (`react-native-mcp-test`)

### Usage

`npx react-native-mcp-test run <path> [options]`

- `<path>`: A YAML file or a directory
  - Directory runs only `.yml`/`.yaml` files **directly under** the directory (no recursive traversal).

### Commands

- `run <path>`: Run a YAML test file or a directory

### Options

- `-p, --platform <ios|android>`: Override `config.platform` from YAML.
- `-r, --reporter <type>`: Reporter type. `console` | `junit` | `json` | `html` | `slack` | `github-pr` (default: `console`)
- `-o, --output <dir>`: Output directory (default: `./results`)
- `--slack-webhook <url>`: Slack webhook URL (for `-r slack`; or set `SLACK_WEBHOOK_URL`)
- `--report-url <url>`: Report link for Slack message (e.g. CI artifact URL)
- `-t, --timeout <ms>`: Global timeout override (connection wait, etc.)
- `-d, --device <id>`: Device ID (idb/adb)
- `--no-bail`: Continue running next suites after a failure (default: bail on first suite failure)
- `--no-auto-launch`: Do not auto-launch the app in `create()`. Use this in CI when you pre-install the app and launch in `setup` (or via workflow steps).
- `-h, --help`: Show help

### Examples

- Run a directory: `npx react-native-mcp-test run path/to/e2e/ -p ios`
- Run a single file: `npx react-native-mcp-test run path/to/suite.yaml -p android`
- Custom output dir: `npx react-native-mcp-test run e2e/ -o e2e-artifacts/yaml-results`
- Keep going after failure: `npx react-native-mcp-test run e2e/ --no-bail`
- CI (built artifact): `node packages/react-native-mcp-test/dist/cli.js run examples/demo-app/e2e/ -p ios -o e2e-artifacts/yaml-results --no-auto-launch`
- HTML report: `npx react-native-mcp-test run e2e/ -r html -o results`
- Slack: `npx react-native-mcp-test run e2e/ -r slack --slack-webhook $SLACK_WEBHOOK`
- GitHub PR comment: In CI, `-r github-pr -o results`

### Reporter types

| Reporter    | Description                                                                                   |
| ----------- | --------------------------------------------------------------------------------------------- |
| `console`   | Terminal summary and step output (default).                                                   |
| `junit`     | `output/junit.xml`. CI JUnit report.                                                          |
| `json`      | `output/results.json`.                                                                        |
| `html`      | `output/report.html`. Visual report with screenshots.                                         |
| `slack`     | Send results to Slack webhook. Requires `--slack-webhook` or `SLACK_WEBHOOK_URL`.             |
| `github-pr` | Post comment on PR via `gh pr comment` when in a PR; otherwise writes `output/pr-comment.md`. |

### How to verify reporters

- **HTML**: After running, open `output/report.html` in a browser and check suite/step summary and failure screenshots.
- **Slack**: Run with `-r slack` and confirm the channel receives the summary and failure details.
- **GitHub PR**: Run with `-r github-pr` on a PR and confirm the PR comment or `output/pr-comment.md` body.
