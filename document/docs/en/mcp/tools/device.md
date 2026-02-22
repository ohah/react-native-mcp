# Device & Status

Tools for connection status, device/app listing, deep links, GPS, app termination, screen orientation/size, and app state reset.

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

## list_apps

List installed apps on the device/simulator. **No app connection required.**

#### Parameters

| Parameter  | Type                 | Required | Description               |
| ---------- | -------------------- | -------- | ------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform           |
| `deviceId` | `string`             | No       | Device ID. Auto if single |

#### Example

```json
// Request
{ "tool": "list_apps", "arguments": { "platform": "ios" } }

// Response (summary + JSON)
// Found N app(s). Use these IDs with terminate_app(platform, appId).
// [ { "id": "com.example.app", "name": "My App" }, ... ]
```

#### Tips

- iOS: `idb list-apps --json`. Android: `pm list packages -3` (third-party only).
- Use returned `id` as `appId` in `terminate_app`.

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

---

## terminate_app

Terminate an app by bundle ID or package name. **No app connection required.** For development and CI only; avoid terminating system or critical apps.

#### Parameters

| Parameter  | Type                 | Required | Description                                               |
| ---------- | -------------------- | -------- | --------------------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform                                           |
| `appId`    | `string`             | **Yes**  | iOS bundle ID or Android package. Use `list_apps` to find |
| `deviceId` | `string`             | No       | Device ID. Auto if single                                 |

#### Example

```json
// Request
{
  "tool": "terminate_app",
  "arguments": { "platform": "android", "appId": "com.example.app" }
}
```

#### Tips

- iOS: `simctl terminate`. Android: `am force-stop`.
- `appId` allows only letters, digits, dots, underscores, hyphens.

---

## get_orientation

Get current screen orientation (portrait/landscape) and platform raw value. **No app connection required.**

#### Parameters

| Parameter  | Type                 | Required | Description               |
| ---------- | -------------------- | -------- | ------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform           |
| `deviceId` | `string`             | No       | Device ID. Auto if single |

#### Example

```json
// Request
{ "tool": "get_orientation", "arguments": { "platform": "ios" } }

// Response
{ "orientation": "portrait", "raw": 1 }
```

#### Tips

- iOS: backboardd GraphicsOrientation (1–4). Android: user_rotation (0–3).

---

## set_orientation

Set screen orientation to portrait or landscape.

#### Parameters

| Parameter     | Type                        | Required | Description               |
| ------------- | --------------------------- | -------- | ------------------------- |
| `platform`    | `"ios" \| "android"`        | **Yes**  | Target platform           |
| `orientation` | `"portrait" \| "landscape"` | **Yes**  | Desired orientation       |
| `deviceId`    | `string`                    | No       | Device ID. Auto if single |

#### Example

```json
// Request
{
  "tool": "set_orientation",
  "arguments": { "platform": "android", "orientation": "landscape" }
}
```

#### Tips

- **Android**: Sets `user_rotation` 0 (portrait) or 1 (landscape).
- **iOS**: Simulator only; returns an error on physical device.

---

## get_screen_size

Get screen dimensions (width and height in px).

#### Parameters

| Parameter  | Type                 | Required | Description               |
| ---------- | -------------------- | -------- | ------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform           |
| `deviceId` | `string`             | No       | Device ID. Auto if single |

#### Example

```json
// Request
{ "tool": "get_screen_size", "arguments": { "platform": "android" } }

// Response
{ "width": 1920, "height": 1200, "unit": "px" }
```

#### Tips

- **Android**: Returns physical pixels from `wm size`. No app connection required.
- **iOS**: Returns from `getScreenInfo()` only when app is connected; otherwise "not supported" error.
