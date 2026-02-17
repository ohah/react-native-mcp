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
  - typeText:
      selector: '#password'
      text: secret
  - tap:
      selector: '#login-button'
  - waitForText:
      text: 'Home'
      timeout: 5000
  - screenshot:
      path: ./results/login-success.png

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
- `-r, --reporter <type>`: Reporter type. `console` | `junit` | `json` (default: `console`)
- `-o, --output <dir>`: Output directory (default: `./results`)
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
