export const appLifecycleGuide = {
  name: 'app-lifecycle',
  description:
    'App launch, terminate, clear data, install, and restart command reference. Covers both Android (adb) and iOS simulator (xcrun simctl).',
  content: `# App Lifecycle Commands

Platform-specific commands for launching, terminating, clearing data, and reinstalling React Native apps.
No dedicated MCP tools exist for these operations — run them via Bash directly.

For deep links, use the \`open_deeplink\` MCP tool instead.

## Launch App

\`\`\`bash
# Android
adb shell am start -n <package>/.MainActivity
# e.g. adb shell am start -n com.example.myapp/.MainActivity

# iOS Simulator
xcrun simctl launch booted <bundleId>
# e.g. xcrun simctl launch booted com.example.myapp
\`\`\`

After launching, the app takes a few seconds to connect to the MCP server.
Use \`get_debugger_status\` and wait for \`appConnected: true\`.

## Terminate App

\`\`\`bash
# Android
adb shell am force-stop <package>
# e.g. adb shell am force-stop com.example.myapp

# iOS Simulator
xcrun simctl terminate booted <bundleId>
# e.g. xcrun simctl terminate booted com.example.myapp
\`\`\`

## Clear App Data

\`\`\`bash
# Android (deletes AsyncStorage, SharedPreferences, etc.)
adb shell pm clear <package>

# iOS Simulator (reset permissions only)
xcrun simctl privacy booted reset all <bundleId>
\`\`\`

> For a full data reset on iOS, uninstall and reinstall:
> \`xcrun simctl uninstall booted <bundleId> && xcrun simctl install booted <path.app>\`

## Install App

\`\`\`bash
# Android
adb install <path.apk>
adb install -r <path.apk>   # reinstall (preserves data)

# iOS Simulator
xcrun simctl install booted <path.app>
\`\`\`

## Restart App (Terminate + Launch)

\`\`\`bash
# Android
adb shell am force-stop com.example.myapp && adb shell am start -n com.example.myapp/.MainActivity

# iOS Simulator
xcrun simctl terminate booted com.example.myapp && xcrun simctl launch booted com.example.myapp
\`\`\`

After restart, wait for MCP server reconnection:
1. Run the command above
2. Poll \`get_debugger_status\` until \`appConnected: true\`
3. Verify initial screen with \`assert_visible\` or \`assert_text\`

## Targeting a Specific Device

When multiple devices are connected:

\`\`\`bash
# Android: use -s to specify serial
adb -s <serial> shell am start -n com.example.myapp/.MainActivity

# iOS: specify UDID directly
xcrun simctl launch <UDID> com.example.myapp
\`\`\`

List devices with the \`list_devices\` MCP tool, or \`adb devices -l\` / \`xcrun simctl list devices booted\`.
`,
};
