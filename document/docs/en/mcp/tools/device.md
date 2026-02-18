# Device & Status

Tools for checking connection status, listing devices, navigating via deep links, setting GPS, and resetting app state.

## get_debugger_status

Check MCP connection status and list connected devices. Call this first to verify your setup.

#### Parameters

| Parameter    | Type     | Required | Description                                                                                 |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------------- |
| `deviceId`   | `string` | No       | Target device for topInsetDp override                                                       |
| `topInsetDp` | `number` | No       | Set Android top inset override (dp). Overrides ADB auto-detect. Persists for the connection |

#### Example

```json
// Request
{ "tool": "get_debugger_status" }

// Response
{
  "appConnected": true,
  "devices": [
    { "deviceId": "emulator-5554", "platform": "android" }
  ]
}
```

#### Tips

- Always call this first to confirm the app is connected before using other tools.
- Use `topInsetDp` on Android if status bar offset is incorrect (e.g., notch devices).

---

## list_devices

List connected simulators/emulators and physical devices.

#### Parameters

| Parameter  | Type                 | Required | Description                                            |
| ---------- | -------------------- | -------- | ------------------------------------------------------ |
| `platform` | `"ios" \| "android"` | **Yes**  | `ios`: lists idb targets. `android`: lists adb devices |

#### Example

```json
// Request
{ "tool": "list_devices", "arguments": { "platform": "android" } }

// Response
[
  { "deviceId": "emulator-5554", "state": "device", "model": "Pixel_7_API_34" }
]
```

#### Tips

- iOS requires [idb](https://fbidb.io/) to be installed.
- Android requires `adb` in your PATH.

---

## open_deeplink

Open a deep link URL on the simulator/device to navigate directly to a specific screen.

#### Parameters

| Parameter  | Type                 | Required | Description                                |
| ---------- | -------------------- | -------- | ------------------------------------------ |
| `url`      | `string`             | **Yes**  | Deep link URL (e.g. `myapp://product/123`) |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform                            |
| `deviceId` | `string`             | No       | Device ID. Auto if single                  |

#### Example

```json
// Request
{
  "tool": "open_deeplink",
  "arguments": {
    "platform": "ios",
    "url": "myapp://settings/profile"
  }
}
```

#### Tips

- Make sure your app has registered the URL scheme in its native configuration.
- iOS: uses `xcrun simctl openurl`. Android: uses `adb shell am start`.

---

## set_location

Set GPS coordinates on an iOS simulator or Android emulator.

#### Parameters

| Parameter   | Type                 | Required | Description               |
| ----------- | -------------------- | -------- | ------------------------- |
| `platform`  | `"ios" \| "android"` | **Yes**  | Target platform           |
| `latitude`  | `number`             | **Yes**  | Latitude (-90 to 90)      |
| `longitude` | `number`             | **Yes**  | Longitude (-180 to 180)   |
| `deviceId`  | `string`             | No       | Device ID. Auto if single |

#### Example

```json
// Request
{
  "tool": "set_location",
  "arguments": {
    "platform": "android",
    "latitude": 37.5665,
    "longitude": 126.978
  }
}
```

#### Tips

- **Android**: Only works on emulators (AVD), not physical devices.
- iOS: Uses `xcrun simctl location set`.

---

## clear_state

Clear app data or reset permissions.

#### Parameters

| Parameter  | Type                 | Required | Description                               |
| ---------- | -------------------- | -------- | ----------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform                           |
| `appId`    | `string`             | **Yes**  | Bundle ID (iOS) or package name (Android) |
| `deviceId` | `string`             | No       | Device ID. Auto if single                 |

#### Example

```json
// Request
{
  "tool": "clear_state",
  "arguments": {
    "platform": "android",
    "appId": "com.myapp"
  }
}
```

#### Tips

- **Android**: Runs `pm clear` — wipes all app data (storage, databases, preferences).
- **iOS**: Only resets privacy permissions (`xcrun simctl privacy reset`). For a full data reset on iOS, uninstall and reinstall the app.
