# Running E2E in GitHub Actions

How to run React Native MCP–based E2E tests automatically in **GitHub Actions**.

## What you need

- **MCP server build**: Run `bun run build` in CI
- **App build**: Xcode/simulator for iOS, emulator or device for Android
- **Test run**: YAML scenario runner (e.g. `npx react-native-mcp-server test run e2e/ -p ios`). This doc and the repo workflows use YAML only.

## E2E CLI (`react-native-mcp-server test`)

- **Usage**: `npx react-native-mcp-server test run <path> [options]`
- **Recommended in CI (built artifact)**: `node packages/react-native-mcp-server/dist/test/cli.js run <path> [options]`
- **Common options**
  - `-p, --platform <ios|android>`: Platform override
  - `-o, --output <dir>`: Output directory (e.g. `-o e2e-artifacts/yaml-results`)
  - `--no-auto-launch`: Do not auto-launch the app in `create()` (useful when you pre-install and launch via `setup`/workflow steps)
  - `--no-bail`: Continue running next suites after a failure
- For the full option list and reporters, see the CLI section in [E2E YAML Reference](./e2e-yaml-reference.md).

## iOS E2E (simulator)

- **Runner**: `macos-latest` (for iOS simulator)
- **Steps**: Checkout → setup Bun → install deps → build MCP server → Ruby/Bundler & CocoaPods → Xcode app build (Release, iphonesimulator) → boot simulator, install & launch app → wait for app load → run E2E YAML runner
- **On failure**: Upload screenshots and logs as artifacts
- **Path filters**: Run only when `packages`, `examples`, `e2e`, or the workflow file change

### iOS workflow example

Full example for `.github/workflows/e2e-ios.yml`:

```yaml
name: E2E iOS

on:
  push:
    branches: [main, develop]
    paths:
      - 'packages/**'
      - 'examples/demo-app/**'
      - 'e2e/**'
      - '.github/workflows/e2e-ios.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'packages/**'
      - 'examples/demo-app/**'
      - 'e2e/**'
      - '.github/workflows/e2e-ios.yml'

jobs:
  check:
    name: Run check
    runs-on: ubuntu-latest
    outputs:
      should-run: ${{ steps.changes.outputs.e2e }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            e2e:
              - 'packages/**'
              - 'examples/demo-app/**'
              - 'e2e/**'
              - '.github/workflows/e2e-ios.yml'

  e2e-ios:
    name: E2E iOS
    needs: check
    if: needs.check.outputs.should-run == 'true'
    runs-on: macos-latest
    timeout-minutes: 45

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Bun cache
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Install dependencies
        run: bun install

      - name: Build MCP server
        run: bun run build

      - name: Build MCP client
        run: bun run --filter @ohah/react-native-mcp-server/client build

      - name: Bundler cache
        uses: actions/cache@v4
        with:
          path: examples/demo-app/ios/vendor/bundle
          key: ${{ runner.os }}-rubygems-${{ hashFiles('examples/demo-app/ios/Gemfile') }}
          restore-keys: |
            ${{ runner.os }}-rubygems-

      - name: Install Ruby Bundler
        run: |
          gem install bundler:2.5.9
          cd examples/demo-app/ios && bundle config set --local path 'vendor/bundle' && bundle install

      - name: iOS app bundle cache
        id: app-cache
        uses: actions/cache@v4
        with:
          path: ${{ runner.temp }}/e2e-app-cache/ios
          key: ${{ runner.os }}-ios-app-${{ hashFiles('examples/demo-app/ios/Podfile.lock', 'examples/demo-app/ios/**/*.pbxproj', 'examples/demo-app/ios/ReactNativeMcpDemo/**', 'examples/demo-app/package.json', 'examples/demo-app/index.js', 'examples/demo-app/metro.config.js', 'examples/demo-app/babel.config.js', 'examples/demo-app/app.json', 'examples/demo-app/tsconfig.json', 'examples/demo-app/src/**', 'examples/demo-app/react-native.config.js', 'packages/react-native-mcp-server/package.json', 'packages/react-native-mcp-server/src/**') }}
          restore-keys: |
            ${{ runner.os }}-ios-app-

      - name: CocoaPods cache
        if: steps.app-cache.outputs.cache-hit != 'true'
        uses: actions/cache@v4
        with:
          path: |
            examples/demo-app/ios/Pods
            ~/Library/Caches/CocoaPods
          key: ${{ runner.os }}-pods-${{ hashFiles('examples/demo-app/ios/Podfile.lock') }}
          restore-keys: |
            ${{ runner.os }}-pods-

      - name: Install CocoaPods
        if: steps.app-cache.outputs.cache-hit != 'true'
        run: bundle exec pod install
        working-directory: examples/demo-app/ios

      - name: DerivedData cache
        if: steps.app-cache.outputs.cache-hit != 'true'
        uses: actions/cache@v4
        with:
          path: ~/DerivedData
          key: ${{ runner.os }}-deriveddata-${{ hashFiles('examples/demo-app/ios/**/*.pbxproj', 'examples/demo-app/ios/Podfile.lock') }}
          restore-keys: |
            ${{ runner.os }}-deriveddata-

      - name: Build iOS app
        if: steps.app-cache.outputs.cache-hit != 'true'
        env:
          REACT_NATIVE_MCP_ENABLED: 'true'
        run: |
          xcodebuild \
            -workspace ReactNativeMcpDemo.xcworkspace \
            -scheme ReactNativeMcpDemo \
            -configuration Release \
            -sdk iphonesimulator \
            -derivedDataPath "$HOME/DerivedData" \
            -quiet
        working-directory: examples/demo-app/ios

      - name: Save iOS app bundle to cache
        if: steps.app-cache.outputs.cache-hit != 'true'
        run: |
          mkdir -p "${{ runner.temp }}/e2e-app-cache/ios"
          cp -R "$HOME/DerivedData/Build/Products/Release-iphonesimulator/"*.app "${{ runner.temp }}/e2e-app-cache/ios/"

      - name: Boot simulator and install app
        run: |
          DEVICE_UDID=$(xcrun simctl list devices iPhone available --json | jq -r '.devices | to_entries[] | .value[] | select(.name | contains("iPhone")) | .udid' | head -n 1)
          if [ -z "$DEVICE_UDID" ]; then
            echo "Error: No available iPhone simulator found"
            exit 1
          fi
          echo "DEVICE_UDID=$DEVICE_UDID" >> $GITHUB_ENV
          echo "Booting simulator: $DEVICE_UDID"
          xcrun simctl boot "$DEVICE_UDID" || true
          APP_PATH=$(find "${{ runner.temp }}/e2e-app-cache/ios" -maxdepth 2 -name "*.app" 2>/dev/null | head -n 1)
          if [ -z "$APP_PATH" ]; then
            echo "Error: No .app found in app cache"
            exit 1
          fi
          echo "Installing app: $APP_PATH"
          xcrun simctl install booted "$APP_PATH"

      - name: Run E2E YAML tests
        run: node packages/react-native-mcp-server/dist/test/cli.js run examples/demo-app/e2e/ -p ios -o e2e-artifacts/yaml-results --no-auto-launch

      - name: Save screenshot and logs on failure
        if: failure()
        run: |
          mkdir -p e2e-artifacts
          xcrun simctl io booted screenshot e2e-artifacts/failure-screenshot.png 2>/dev/null || true
          xcrun simctl spawn booted log show --last 1m 2>/dev/null | tail -n 3000 > e2e-artifacts/simulator-log.txt || true

      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-ios-failure-artifacts
          path: e2e-artifacts/
          retention-days: 14
          if-no-files-found: ignore
```

## Android E2E (emulator)

- **Runner**: `ubuntu-latest`
- **Steps**: Checkout → setup Bun → install deps → build MCP server → Android SDK & emulator setup → build app (Release/Debug) → boot emulator, install & launch app → wait → run E2E YAML runner
- **On failure**: Upload logs and screenshots as artifacts
- **Disk**: Android runners often need a step to free disk space (e.g. remove unused packages)

### Android workflow example

Full example for `.github/workflows/e2e-android.yml`:

```yaml
name: E2E Android

on:
  push:
    branches: [main, develop]
    paths:
      - 'packages/**'
      - 'examples/demo-app/**'
      - 'e2e/**'
      - '.github/workflows/e2e-android.yml'
  pull_request:
    branches: [main, develop]
    paths:
      - 'packages/**'
      - 'examples/demo-app/**'
      - 'e2e/**'
      - '.github/workflows/e2e-android.yml'

jobs:
  check:
    name: Run check
    runs-on: ubuntu-latest
    outputs:
      should-run: ${{ steps.changes.outputs.e2e }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v2
        id: changes
        with:
          filters: |
            e2e:
              - 'packages/**'
              - 'examples/demo-app/**'
              - 'e2e/**'
              - '.github/workflows/e2e-android.yml'

  e2e-android:
    name: E2E Android
    needs: check
    if: needs.check.outputs.should-run == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Free disk space
        run: |
          sudo apt-get remove -y '^dotnet-.*' 'php.*' '^mongodb-.*' '^mysql-.*' azure-cli google-chrome-stable firefox powershell mono-devel libgl1-mesa-dri
          sudo apt-get autoremove -y
          sudo apt-get clean
          sudo rm -rf /usr/share/dotnet/ /usr/local/graalvm/ /usr/local/.ghcup/ /usr/local/share/powershell /usr/local/share/chromium

      - name: Enable KVM
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Bun cache
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Setup Java 17
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Install dependencies
        run: bun install

      - name: Build MCP server
        run: bun run build

      - name: Build MCP client
        run: bun run --filter @ohah/react-native-mcp-server/client build

      - name: Gradle cache
        uses: gradle/actions/setup-gradle@v4

      - name: Debug keystore cache
        uses: actions/cache@v4
        id: keystore-cache
        with:
          path: examples/demo-app/android/app/debug.keystore
          key: android-debug-keystore

      - name: Generate debug keystore (CI)
        if: steps.keystore-cache.outputs.cache-hit != 'true'
        run: |
          keytool -genkey -v -keystore app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "C=US, O=Android, CN=Android Debug"
        working-directory: examples/demo-app/android

      - name: Android APK cache
        id: app-cache
        uses: actions/cache@v4
        with:
          path: ${{ runner.temp }}/e2e-app-cache/android
          key: ${{ runner.os }}-android-apk-${{ hashFiles('examples/demo-app/android/build.gradle', 'examples/demo-app/android/settings.gradle', 'examples/demo-app/android/app/build.gradle', 'examples/demo-app/android/app/src/**', 'examples/demo-app/package.json', 'examples/demo-app/index.js', 'examples/demo-app/metro.config.js', 'examples/demo-app/babel.config.js', 'examples/demo-app/app.json', 'examples/demo-app/tsconfig.json', 'examples/demo-app/src/**', 'examples/demo-app/react-native.config.js', 'packages/react-native-mcp-server/package.json', 'packages/react-native-mcp-server/src/**') }}
          restore-keys: |
            ${{ runner.os }}-android-apk-

      - name: Build demo app Release APK
        if: steps.app-cache.outputs.cache-hit != 'true'
        env:
          REACT_NATIVE_MCP_ENABLED: 'true'
        run: ./gradlew assembleRelease
        working-directory: examples/demo-app/android

      - name: Save Android APK to cache
        if: steps.app-cache.outputs.cache-hit != 'true'
        run: |
          mkdir -p "${{ runner.temp }}/e2e-app-cache/android"
          cp examples/demo-app/android/app/build/outputs/apk/release/app-release.apk "${{ runner.temp }}/e2e-app-cache/android/"

      - name: Copy APK to build output (cache hit)
        if: steps.app-cache.outputs.cache-hit == 'true'
        run: |
          mkdir -p examples/demo-app/android/app/build/outputs/apk/release
          cp "${{ runner.temp }}/e2e-app-cache/android/app-release.apk" examples/demo-app/android/app/build/outputs/apk/release/

      - name: AVD cache
        uses: actions/cache@v4
        id: avd-cache
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: avd-34

      - name: Create AVD snapshot (cache miss)
        if: steps.avd-cache.outputs.cache-hit != 'true'
        uses: reactivecircus/android-emulator-runner@v2
        with:
          avd-name: avd-34
          api-level: 34
          target: google_apis
          arch: x86_64
          force-avd-creation: false
          emulator-options: -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
          disable-animations: false
          script: echo "Generated AVD snapshot for caching."

      - name: Run E2E YAML tests
        id: e2e-test
        uses: reactivecircus/android-emulator-runner@v2
        with:
          avd-name: avd-34
          api-level: 34
          target: google_apis
          arch: x86_64
          force-avd-creation: false
          emulator-options: -no-snapshot-save -no-window -gpu swiftshader_indirect -noaudio -no-boot-anim -camera-back none
          disable-animations: true
          script: |
            ls -la examples/demo-app/android/app/build/outputs/apk/release/app-release.apk
            adb install -r examples/demo-app/android/app/build/outputs/apk/release/app-release.apk
            adb reverse tcp:12300 tcp:12300
            node packages/react-native-mcp-server/dist/test/cli.js run examples/demo-app/e2e/ -p android -o e2e-artifacts/yaml-results --no-auto-launch

      - name: Save screenshot and logs on failure
        if: failure()
        run: |
          mkdir -p e2e-artifacts
          adb exec-out screencap -p > e2e-artifacts/failure-screenshot.png 2>/dev/null || true
          adb logcat -d 2>/dev/null | tail -n 3000 > e2e-artifacts/logcat.txt || true

      - name: Upload artifacts
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-android-failure-artifacts
          path: e2e-artifacts/
          retention-days: 14
          if-no-files-found: ignore
```

## Running YAML scenarios in CI

- In the E2E workflow, after building and launching the app, run `bun run test:yaml` (or the package's run script) in the same job.
- Ensure `config.bundleId` in the YAML matches the built app's bundle ID.
- Either use `launch` in the scenario `setup` or start the app in a previous step and run only the scenario.

## Summary

| Item      | iOS                                                                   | Android          |
| --------- | --------------------------------------------------------------------- | ---------------- |
| Runner    | macos-latest                                                          | ubuntu-latest    |
| App build | Xcode, simulator                                                      | Gradle, emulator |
| Run       | YAML runner (e.g. `npx react-native-mcp-server test run e2e/ -p ios`) | Same             |
| Paths     | packages, examples, e2e, workflow                                     | Same             |
