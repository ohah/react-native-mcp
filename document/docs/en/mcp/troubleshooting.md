# Troubleshooting

Common issues when using React Native MCP, and how to fix them.

---

## "No app connected" / `appConnected: false`

When `get_debugger_status` returns `appConnected: false` and `devices: []`, the app has not connected to the MCP server's WebSocket (port 12300).

### How it works

- The MCP server opens a WebSocket server on **port 12300**.
- The app's runtime connects to `ws://localhost:12300`.
- After connection, the app sends an `init` message, the server registers the device, and `appConnected` becomes `true`.

If the app never connects to port 12300, `appConnected` stays `false`.

### Cause 1: Two MCP server processes (most common)

**Symptom**: One process was started by Cursor, and another by `npx @ohah/react-native-mcp-server` in a terminal. Port 12300 can only be used by one process. The first one succeeds; the second gets `EADDRINUSE`.

The app connects to the process that owns port 12300 (A), but Cursor talks to the other process (B) via stdio — so Cursor always sees `appConnected: false`.

**Check**:

```bash
lsof -i :12300
```

If multiple processes are listed, this is the issue.

**Fix**:

```bash
kill $(lsof -t -i :12300)
```

Then run the MCP server from **one place only** — either Cursor or terminal, not both.

### Cause 2: Port 12300 bind failure

Even with a single process, if it starts before a previous process fully released the port, the bind fails silently.

**Check**: Look for `WebSocket server listening on ws://localhost:12300` in the MCP logs. If missing and `EADDRINUSE` appears, the process isn't listening.

**Fix**: Kill the port, restart the MCP server or Cursor.

### Cause 3: App can't reach localhost

The runtime uses `ws://localhost:12300`.

| Environment      | localhost points to | Connection                              |
| ---------------- | ------------------- | --------------------------------------- |
| iOS simulator    | Host machine        | Works                                   |
| Android emulator | Emulator itself     | Needs `adb reverse tcp:12300 tcp:12300` |
| Physical device  | Device itself       | Not supported (need host IP)            |

**Fix**: For Android emulator, run:

```bash
adb reverse tcp:12300 tcp:12300
```

### Cause 4: MCP runtime not in the bundle

If `__REACT_NATIVE_MCP__` doesn't exist, the runtime wasn't injected.

**Check**: Look for `[MCP] runtime loaded, __REACT_NATIVE_MCP__ available` in app logs.

**Fix**:

1. Verify `@ohah/react-native-mcp-server/babel-preset` is in `babel.config.js`
2. Clear Metro cache and rebuild:
   ```bash
   npx react-native start --reset-cache
   # or for Expo
   npx expo start --clear
   ```
3. For non-dev builds, run Metro with `REACT_NATIVE_MCP_ENABLED=true`

### Summary table

| Symptom                                 | Cause                                                                 |
| --------------------------------------- | --------------------------------------------------------------------- |
| `EADDRINUSE` in logs                    | Two MCP server processes — app connects to one, Cursor uses the other |
| Single process, no "listening on 12300" | This process failed to bind port 12300                                |
| Single process, iOS simulator only      | Runtime not injected or Metro cache issue                             |
| Android emulator / physical device      | localhost doesn't reach the host machine                              |

---

## Tap / screenshot not working

### iOS simulator

- **idb required**: Install [idb](https://fbidb.io/):
  ```bash
  brew tap facebook/fb && brew install idb-companion
  pip3 install fb-idb
  ```
- **Verify**: `idb list-targets` should show your simulator
- **Simulator must be booted**: `xcrun simctl boot <UDID>` if needed

### Android emulator/device

- **adb required**: Included with Android Studio, or:
  ```bash
  brew install --cask android-platform-tools
  ```
- **Verify**: `adb devices` should show your device
- **Port forwarding**: `adb reverse tcp:12300 tcp:12300`

### Common issues

- **Wrong coordinates**: If taps land in the wrong place, check that you're using the correct coordinate system (points for iOS, dp for Android). Use `query_selector` to get accurate measurements.
- **Landscape mode**: For iOS landscape, pass the `iosOrientation` parameter to tap/swipe tools.

---

## Metro cache issues

After changing Babel config or updating the MCP package, clear Metro cache:

```bash
# Bare RN
npx react-native start --reset-cache

# Expo
npx expo start --clear
```

---

## Recommended diagnostic steps

1. **Ensure only one MCP server process**

   ```bash
   lsof -i :12300
   ```

   Should show at most one process. If multiple, `kill $(lsof -t -i :12300)` and restart.

2. **Check MCP logs**
   - Look for: `WebSocket server listening on ws://localhost:12300`
   - Should NOT have: `EADDRINUSE`

3. **Check runtime environment**
   - iOS simulator, Android emulator (with `adb reverse`), or dev build
   - Physical devices require additional network setup

4. **Check app logs**
   - `[MCP] runtime loaded, __REACT_NATIVE_MCP__ available` — runtime injected
   - `[MCP] Connected to server ws://localhost:12300` — connected to server

5. **Test the connection**
   - Call `get_debugger_status` — should show devices
   - Call `evaluate_script` with `() => 1 + 2` — should return `3`
