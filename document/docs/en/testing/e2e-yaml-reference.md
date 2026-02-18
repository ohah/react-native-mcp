---
description: Reference for the YAML scenario syntax used by react-native-mcp-test (file structure, config, steps, teardown).
---

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

The runner supports **33 step types** across 7 categories. See the [Steps Reference](./steps/) for full details on every step.

| Category                                  | Steps | Description                                          |
| ----------------------------------------- | ----- | ---------------------------------------------------- |
| [Interaction](./steps/interaction)        | 8     | Tap, swipe, type, long press, double tap, scroll     |
| [Assertions](./steps/assertions)          | 6     | Verify text, visibility, element count, value        |
| [Waits](./steps/waits)                    | 4     | Wait for text, visibility, or fixed delay            |
| [Navigation & Device](./steps/navigation) | 7     | Press button, back, home, deep link, location, reset |
| [App Lifecycle](./steps/lifecycle)        | 2     | Launch and terminate apps                            |
| [Screenshots](./steps/screenshots)        | 2     | Capture and compare screenshots                      |
| [Utilities](./steps/utilities)            | 4     | Copy/paste text, run JS, add media                   |

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
