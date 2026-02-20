---
description: View E2E test results in a web dashboard. Recent runs, step details, and flaky detection.
---

# E2E Dashboard

When you run E2E tests with the **dashboard** reporter, results are appended to `runs.json` and you can view recent runs, step details, and flaky steps in a web dashboard.

## How to use

### 1. Run tests with the dashboard

Specify an output directory (`-o`) and the reporter (`-r dashboard`):

```bash
bun run build
bun packages/react-native-mcp-server/dist/index.js test run <YAML-path> -r dashboard -o <output-dir>
```

Example (monorepo root):

```bash
bun run dashboard
```

This writes results under `e2e-results` and opens the dashboard in the browser when the run finishes.

### 2. View existing results only

To serve and open already-saved results without re-running tests:

```bash
bun run dashboard:show
```

Or via CLI with output directory and port:

```bash
bun packages/react-native-mcp-server/dist/index.js test report show -o e2e-results -p 9323
```

The default port is **9323**; open `http://127.0.0.1:9323/` in the browser.

## What the dashboard shows

- **Latest run**: Passed/failed/skipped counts and duration of the last run
- **Recent runs**: List of recent runs. **Click a row** to expand that run’s suites and steps
- **Step detail**: Click **Detail** next to a step to expand the step payload (JSON) or label, plus error message and screenshot filename when the step failed
- **Flaky**: Steps that passed at least once and failed at least once in the last 20 runs

Data is stored in `&lt;output-dir&gt;/dashboard/runs.json` with up to 100 runs kept.
