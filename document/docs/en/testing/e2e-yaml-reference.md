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
setup?: Step[] # Run before main steps (optional)
steps: Step[] # Main test steps (required, 1+)
teardown?: Step[] # Run on exit (optional)
```

- `config.platform`: `ios` | `android`. Can be overridden by CLI `-p`.
- `config.bundleId`: e.g. `org.example.app` (iOS), `com.example.app` (Android). Runner starts the app after the server is up.
- `setup` / `teardown`: Each is `Step[]`. `teardown` runs even when a step fails.

---

## Step types

Use **exactly one** of the keys below. `selector` follows MCP selector syntax (e.g. `#testID`, `Text:text("label")`).

### tap

Tap the element once.

- **iOS**: Only **0° (portrait) and 90° (landscape right)**. 180° and 270° are not supported.
- **Android**: No orientation correction; verified working.

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

| Field     | Type   | Required | Description                             |
| --------- | ------ | -------- | --------------------------------------- |
| selector  | string | ✓        | Target element selector                 |
| direction | string | ✓        | `up` \| `down` \| `left` \| `right`     |
| distance  | number |          | Swipe distance (px). Default if omitted |

```yaml
- swipe:
    selector: '#list'
    direction: up
    distance: 200
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

## Running

- Directory: `npx react-native-mcp-test run path/to/e2e/ -p ios`
- Single file: `npx react-native-mcp-test run path/to/suite.yaml -p android`
- `-p` runs only the selected platform’s suites.
