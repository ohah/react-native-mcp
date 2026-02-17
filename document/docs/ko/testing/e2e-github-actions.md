# GitHub Actions에서 E2E 실행

React Native MCP 기반 E2E 테스트를 **GitHub Actions**에서 자동으로 실행하는 방법입니다.

## 필요한 것

- **MCP 서버 빌드**: CI에서 `bun run build`로 서버 빌드
- **앱 빌드**: iOS는 Xcode/시뮬레이터, Android는 에뮬레이터 또는 실제 기기
- **테스트 실행**: YAML 시나리오 러너 (예: `npx react-native-mcp-test run e2e/ -p ios`). 이 문서와 저장소 워크플로는 YAML만 사용합니다.

## iOS E2E (시뮬레이터)

- **Runner**: `macos-latest` (iOS 시뮬레이터 사용 가능)
- **순서**: 체크아웃 → Bun 설치 → 의존성 설치 → MCP 서버 빌드 → Ruby/Bundler·CocoaPods → Xcode 앱 빌드 (Release, iphonesimulator) → 시뮬레이터 부팅·앱 설치·실행 → 앱 로드 대기 → E2E YAML 러너 실행
- **실패 시**: 스크린샷·로그를 아티팩트로 업로드
- **경로 필터**: `packages`, `examples`, `e2e`, 워크플로 파일 변경 시에만 실행 권장

### iOS 워크플로 예제

`.github/workflows/e2e-ios.yml` 에 넣을 수 있는 전체 예제입니다.

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
    name: 실행 여부 확인
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
    name: E2E iOS 테스트
    needs: check
    if: needs.check.outputs.should-run == 'true'
    runs-on: macos-latest
    timeout-minutes: 45

    steps:
      - name: 코드 체크아웃
        uses: actions/checkout@v4

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Bun 설정
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Bun 캐시
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: 의존성 설치
        run: bun install

      - name: MCP 서버 빌드
        run: bun run build

      - name: MCP 클라이언트 빌드
        run: bun run --filter @ohah/react-native-mcp-client build

      - name: Bundler 캐시
        uses: actions/cache@v4
        with:
          path: examples/demo-app/ios/vendor/bundle
          key: ${{ runner.os }}-rubygems-${{ hashFiles('examples/demo-app/ios/Gemfile') }}
          restore-keys: |
            ${{ runner.os }}-rubygems-

      - name: Ruby Bundler 설치
        run: |
          gem install bundler:2.5.9
          cd examples/demo-app/ios && bundle config set --local path 'vendor/bundle' && bundle install

      - name: iOS 앱 번들 캐시
        id: app-cache
        uses: actions/cache@v4
        with:
          path: ${{ runner.temp }}/e2e-app-cache/ios
          key: ${{ runner.os }}-ios-app-${{ hashFiles('examples/demo-app/ios/Podfile.lock', 'examples/demo-app/ios/**/*.pbxproj', 'examples/demo-app/ios/ReactNativeMcpDemo/**', 'examples/demo-app/package.json', 'examples/demo-app/index.js', 'examples/demo-app/metro.config.js', 'examples/demo-app/babel.config.js', 'examples/demo-app/app.json', 'examples/demo-app/tsconfig.json', 'examples/demo-app/src/**', 'examples/demo-app/react-native.config.js', 'packages/react-native-mcp-client/package.json', 'packages/react-native-mcp-client/src/**') }}
          restore-keys: |
            ${{ runner.os }}-ios-app-

      - name: CocoaPods 캐시
        if: steps.app-cache.outputs.cache-hit != 'true'
        uses: actions/cache@v4
        with:
          path: |
            examples/demo-app/ios/Pods
            ~/Library/Caches/CocoaPods
          key: ${{ runner.os }}-pods-${{ hashFiles('examples/demo-app/ios/Podfile.lock') }}
          restore-keys: |
            ${{ runner.os }}-pods-

      - name: CocoaPods 설치
        if: steps.app-cache.outputs.cache-hit != 'true'
        run: bundle exec pod install
        working-directory: examples/demo-app/ios

      - name: DerivedData 캐시
        if: steps.app-cache.outputs.cache-hit != 'true'
        uses: actions/cache@v4
        with:
          path: ~/DerivedData
          key: ${{ runner.os }}-deriveddata-${{ hashFiles('examples/demo-app/ios/**/*.pbxproj', 'examples/demo-app/ios/Podfile.lock') }}
          restore-keys: |
            ${{ runner.os }}-deriveddata-

      - name: iOS 앱 빌드
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

      - name: iOS 앱 번들 캐시 저장
        if: steps.app-cache.outputs.cache-hit != 'true'
        run: |
          mkdir -p "${{ runner.temp }}/e2e-app-cache/ios"
          cp -R "$HOME/DerivedData/Build/Products/Release-iphonesimulator/"*.app "${{ runner.temp }}/e2e-app-cache/ios/"

      - name: 시뮬레이터 부팅 및 앱 설치
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

      - name: E2E YAML 테스트 실행
        run: node packages/react-native-mcp-test/dist/cli.js run examples/demo-app/e2e/ -p ios -o e2e-artifacts/yaml-results --no-auto-launch

      - name: 실패 시 스크린샷·로그 저장
        if: failure()
        run: |
          mkdir -p e2e-artifacts
          xcrun simctl io booted screenshot e2e-artifacts/failure-screenshot.png 2>/dev/null || true
          xcrun simctl spawn booted log show --last 1m 2>/dev/null | tail -n 3000 > e2e-artifacts/simulator-log.txt || true

      - name: 아티팩트 업로드
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-ios-failure-artifacts
          path: e2e-artifacts/
          retention-days: 14
          if-no-files-found: ignore
```

## Android E2E (에뮬레이터)

- **Runner**: `ubuntu-latest`
- **순서**: 체크아웃 → Bun 설치 → 의존성 설치 → MCP 서버 빌드 → Android SDK·에뮬레이터 설정 → 앱 빌드 (Release/Debug) → 에뮬레이터 부팅·앱 설치·실행 → 로드 대기 → E2E YAML 러너 실행
- **실패 시**: 로그·스크린샷 아티팩트 업로드
- **디스크**: Android runner는 디스크 부족이 나기 쉬우므로 불필요한 패키지 제거 등 공간 확보 단계를 넣는 경우가 많습니다.

### Android 워크플로 예제

`.github/workflows/e2e-android.yml` 에 넣을 수 있는 전체 예제입니다.

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
    name: 실행 여부 확인
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
    name: E2E Android 테스트
    needs: check
    if: needs.check.outputs.should-run == 'true'
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: 코드 체크아웃
        uses: actions/checkout@v4

      - name: 디스크 공간 확보
        run: |
          sudo apt-get remove -y '^dotnet-.*' 'php.*' '^mongodb-.*' '^mysql-.*' azure-cli google-chrome-stable firefox powershell mono-devel libgl1-mesa-dri
          sudo apt-get autoremove -y
          sudo apt-get clean
          sudo rm -rf /usr/share/dotnet/ /usr/local/graalvm/ /usr/local/.ghcup/ /usr/local/share/powershell /usr/local/share/chromium

      - name: KVM 활성화
        run: |
          echo 'KERNEL=="kvm", GROUP="kvm", MODE="0666", OPTIONS+="static_node=kvm"' | sudo tee /etc/udev/rules.d/99-kvm4all.rules
          sudo udevadm control --reload-rules
          sudo udevadm trigger --name-match=kvm

      - name: Node.js 설정
        uses: actions/setup-node@v4
        with:
          node-version: 24

      - name: Bun 설정
        uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Bun 캐시
        uses: actions/cache@v4
        with:
          path: ~/.bun/install/cache
          key: ${{ runner.os }}-bun-${{ hashFiles('bun.lock') }}
          restore-keys: |
            ${{ runner.os }}-bun-

      - name: Java 17 설정
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: 의존성 설치
        run: bun install

      - name: MCP 서버 빌드
        run: bun run build

      - name: MCP 클라이언트 빌드
        run: bun run --filter @ohah/react-native-mcp-client build

      - name: Gradle 캐시
        uses: gradle/actions/setup-gradle@v4

      - name: Debug keystore 캐시
        uses: actions/cache@v4
        id: keystore-cache
        with:
          path: examples/demo-app/android/app/debug.keystore
          key: android-debug-keystore

      - name: Debug keystore 생성 (CI용)
        if: steps.keystore-cache.outputs.cache-hit != 'true'
        run: |
          keytool -genkey -v -keystore app/debug.keystore -storepass android -alias androiddebugkey -keypass android -keyalg RSA -keysize 2048 -validity 10000 -dname "C=US, O=Android, CN=Android Debug"
        working-directory: examples/demo-app/android

      - name: Android APK 캐시
        id: app-cache
        uses: actions/cache@v4
        with:
          path: ${{ runner.temp }}/e2e-app-cache/android
          key: ${{ runner.os }}-android-apk-${{ hashFiles('examples/demo-app/android/build.gradle', 'examples/demo-app/android/settings.gradle', 'examples/demo-app/android/app/build.gradle', 'examples/demo-app/android/app/src/**', 'examples/demo-app/package.json', 'examples/demo-app/index.js', 'examples/demo-app/metro.config.js', 'examples/demo-app/babel.config.js', 'examples/demo-app/app.json', 'examples/demo-app/tsconfig.json', 'examples/demo-app/src/**', 'examples/demo-app/react-native.config.js', 'packages/react-native-mcp-client/package.json', 'packages/react-native-mcp-client/src/**') }}
          restore-keys: |
            ${{ runner.os }}-android-apk-

      - name: 데모앱 Release APK 빌드
        if: steps.app-cache.outputs.cache-hit != 'true'
        env:
          REACT_NATIVE_MCP_ENABLED: 'true'
        run: ./gradlew assembleRelease
        working-directory: examples/demo-app/android

      - name: Android APK 캐시 저장
        if: steps.app-cache.outputs.cache-hit != 'true'
        run: |
          mkdir -p "${{ runner.temp }}/e2e-app-cache/android"
          cp examples/demo-app/android/app/build/outputs/apk/release/app-release.apk "${{ runner.temp }}/e2e-app-cache/android/"

      - name: APK를 빌드 출력 경로에 복사 (캐시 히트 시 E2E 스크립트가 사용)
        if: steps.app-cache.outputs.cache-hit == 'true'
        run: |
          mkdir -p examples/demo-app/android/app/build/outputs/apk/release
          cp "${{ runner.temp }}/e2e-app-cache/android/app-release.apk" examples/demo-app/android/app/build/outputs/apk/release/

      - name: AVD 캐시
        uses: actions/cache@v4
        id: avd-cache
        with:
          path: |
            ~/.android/avd/*
            ~/.android/adb*
          key: avd-34

      - name: AVD 스냅샷 생성 (캐시 미스 시)
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

      - name: E2E YAML 테스트 실행
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
            node packages/react-native-mcp-test/dist/cli.js run examples/demo-app/e2e/ -p android -o e2e-artifacts/yaml-results --no-auto-launch

      - name: 실패 시 스크린샷·로그 저장
        if: failure()
        run: |
          mkdir -p e2e-artifacts
          adb exec-out screencap -p > e2e-artifacts/failure-screenshot.png 2>/dev/null || true
          adb logcat -d 2>/dev/null | tail -n 3000 > e2e-artifacts/logcat.txt || true

      - name: 아티팩트 업로드
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: e2e-android-failure-artifacts
          path: e2e-artifacts/
          retention-days: 14
          if-no-files-found: ignore
```

## YAML 시나리오를 CI에서 실행할 때

- E2E 워크플로에서 앱을 빌드·실행한 뒤, **같은 job** 안에서 `bun run test:yaml`(또는 해당 패키지의 run 스크립트)로 YAML 시나리오를 실행하면 됩니다.
- YAML의 `config.bundleId`와 실제 빌드한 앱의 bundleId가 일치해야 합니다.
- `setup`의 `launch`로 앱을 띄우거나, 이미 워크플로 단계에서 앱을 실행해 두고 시나리오만 돌리는 방식 중 하나를 선택하면 됩니다.

## 요약

| 항목      | iOS                                                         | Android            |
| --------- | ----------------------------------------------------------- | ------------------ |
| Runner    | macos-latest                                                | ubuntu-latest      |
| 앱 빌드   | Xcode, 시뮬레이터                                           | Gradle, 에뮬레이터 |
| 실행 예시 | YAML 러너 (예: `npx react-native-mcp-test run e2e/ -p ios`) | 동일               |
| 경로 필터 | packages, examples, e2e, 워크플로                           | 동일               |
