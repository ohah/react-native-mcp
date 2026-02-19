# Running E2E in GitHub Actions

How to run React Native MCP–based E2E tests automatically in **GitHub Actions**.  
Use the existing iOS/Android E2E workflows in the repo as reference.

## What you need

- **MCP server build**: Run `bun run build` in CI
- **App build**: Xcode/simulator for iOS, emulator or device for Android
- **Test run**: `bun test e2e/...` (smoke tests) or the YAML scenario runner

## E2E CLI (`@ohah/react-native-mcp-server test`)

- **Usage**: `npx @ohah/react-native-mcp-server test run <path> [options]`
- **Recommended in CI (built artifact)**: `node packages/react-native-mcp-server/dist/test/cli.js run <path> [options]`
- **Common options**
  - `-p, --platform <ios|android>`: Platform override
  - `-o, --output <dir>`: Output directory
  - `--no-auto-launch`: Use when you pre-install the app and launch via the scenario `setup`
- For the full option list and reporters, see the CLI section in [E2E YAML Reference](../testing/e2e-yaml-reference.md).

## iOS E2E (simulator)

Same flow as `.github/workflows/e2e-ios.yml` in the repo.

1. **Runner**: `macos-latest` (for iOS simulator)
2. **Steps**:
   - Checkout → setup Bun → install deps
   - Build MCP server (`bun run build`)
   - Ruby/Bundler → CocoaPods (if needed)
   - Build app with Xcode (Release, iphonesimulator)
   - Boot simulator → install app → launch app
   - Wait for app/JS bundle (e.g. 25s)
   - Run E2E: `E2E_PLATFORM=ios bun test e2e/smoke.test.ts` (or YAML runner)
3. **On failure**: Upload screenshots and logs as artifacts for debugging

Use path filters (`paths`) so the workflow runs only when packages, examples, e2e, or the workflow file change.

## Android E2E (emulator)

Same flow as `.github/workflows/e2e-android.yml`.

1. **Runner**: `ubuntu-latest`
2. **Steps**:
   - Checkout → setup Bun → install deps
   - Build MCP server
   - Setup Android SDK and emulator (image, AVD)
   - Build app (Release or Debug)
   - Boot emulator → install app → launch app
   - Wait, then run E2E: `E2E_PLATFORM=android bun test e2e/smoke.test.ts` (or YAML runner)
3. **On failure**: Upload logs and screenshots as artifacts

Android runners can run out of disk space; the workflow often includes steps to free space (e.g. removing unused packages).

## Running YAML scenarios in CI

- In the E2E workflow, after building and launching the app, run `bun run test:yaml` (or the package’s run script) in the same job.
- Ensure `config.bundleId` in the YAML matches the built app’s bundle ID.
- Either use `launch` in the scenario `setup` or start the app in a previous step and run only the scenario.

## Summary

| Item      | iOS                                         | Android          |
| --------- | ------------------------------------------- | ---------------- |
| Runner    | macos-latest                                | ubuntu-latest    |
| App build | Xcode, simulator                            | Gradle, emulator |
| Run       | `bun test e2e/smoke.test.ts` or YAML runner | Same             |
| Paths     | packages, examples, e2e, workflow           | Same             |

See `.github/workflows/e2e-ios.yml` and `.github/workflows/e2e-android.yml` in the repo for the full workflows.
