# Device & Status

연결 상태 확인, 디바이스·앱 목록 조회, 딥링크 네비게이션, GPS 설정, 앱 종료, 화면 방향·크기 조회/설정, 앱 상태 초기화를 위한 도구입니다.

## get_debugger_status

MCP 연결 상태를 확인하고 연결된 디바이스 목록을 조회합니다. 다른 도구를 사용하기 전에 이 도구를 먼저 호출하여 설정을 확인하세요.

#### Parameters

| Parameter    | Type     | Required | Description                                                                           |
| ------------ | -------- | -------- | ------------------------------------------------------------------------------------- |
| `deviceId`   | `string` | No       | topInsetDp 오버라이드 대상 디바이스                                                   |
| `topInsetDp` | `number` | No       | Android 상단 인셋 오버라이드 값(dp). ADB 자동 감지를 덮어씁니다. 연결 동안 유지됩니다 |

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

- 다른 도구를 사용하기 전에 항상 이 도구를 먼저 호출하여 앱이 연결되어 있는지 확인하세요.
- Android에서 상태 바 오프셋이 올바르지 않은 경우(예: 노치 디바이스) `topInsetDp`를 사용하세요.

---

## list_devices

연결된 시뮬레이터/에뮬레이터 및 실제 디바이스 목록을 조회합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                  |
| ---------- | -------------------- | -------- | ------------------------------------------------------------ |
| `platform` | `"ios" \| "android"` | **Yes**  | `ios`: idb 대상 목록 조회. `android`: adb 디바이스 목록 조회 |

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

- iOS는 [idb](https://fbidb.io/)가 설치되어 있어야 합니다.
- Android는 PATH에 `adb`가 포함되어 있어야 합니다.

---

## list_apps

디바이스/시뮬레이터에 설치된 앱 목록을 조회합니다. **앱 연결 불필요.**

#### Parameters

| Parameter  | Type                 | Required | Description                                 |
| ---------- | -------------------- | -------- | ------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                 |
| `deviceId` | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

#### Example

```json
// Request
{ "tool": "list_apps", "arguments": { "platform": "ios" } }

// Response (요약 + JSON)
// Found N app(s). Use these IDs with terminate_app(platform, appId).
// [ { "id": "com.example.app", "name": "My App" }, ... ]
```

#### Tips

- iOS: `idb list-apps --json`. Android: `pm list packages -3`(서드파티만).
- 반환된 `id`는 `terminate_app`의 `appId`로 사용할 수 있습니다.

---

## open_deeplink

시뮬레이터/디바이스에서 딥링크 URL을 열어 특정 화면으로 직접 이동합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                 |
| ---------- | -------------------- | -------- | ------------------------------------------- |
| `url`      | `string`             | **Yes**  | 딥링크 URL (예: `myapp://product/123`)      |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                 |
| `deviceId` | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

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

- 앱의 네이티브 설정에 URL 스킴이 등록되어 있는지 확인하세요.
- iOS: `xcrun simctl openurl`을 사용합니다. Android: `adb shell am start`를 사용합니다.

---

## set_location

iOS 시뮬레이터 또는 Android 에뮬레이터에서 GPS 좌표를 설정합니다.

#### Parameters

| Parameter   | Type                 | Required | Description                                 |
| ----------- | -------------------- | -------- | ------------------------------------------- |
| `platform`  | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                 |
| `latitude`  | `number`             | **Yes**  | 위도 (-90 ~ 90)                             |
| `longitude` | `number`             | **Yes**  | 경도 (-180 ~ 180)                           |
| `deviceId`  | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

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

- **Android**: 에뮬레이터(AVD)에서만 동작하며, 실제 디바이스에서는 사용할 수 없습니다.
- iOS: `xcrun simctl location set`을 사용합니다.

---

## clear_state

앱 데이터를 삭제하거나 권한을 초기화합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                 |
| ---------- | -------------------- | -------- | ------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                 |
| `appId`    | `string`             | **Yes**  | Bundle ID (iOS) 또는 패키지 이름 (Android)  |
| `deviceId` | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

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

- **Android**: `pm clear`를 실행하여 모든 앱 데이터(스토리지, 데이터베이스, 환경설정)를 삭제합니다.
- **iOS**: 개인정보 권한만 초기화합니다(`xcrun simctl privacy reset`). iOS에서 전체 데이터를 초기화하려면 앱을 삭제 후 재설치해야 합니다.

---

## terminate_app

앱을 번들 ID / 패키지명으로 종료합니다. **앱 연결 불필요.** 개발·CI 용도로만 사용하고, 시스템/중요 앱 종료는 피하세요.

#### Parameters

| Parameter  | Type                 | Required | Description                                                  |
| ---------- | -------------------- | -------- | ------------------------------------------------------------ |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                                  |
| `appId`    | `string`             | **Yes**  | iOS Bundle ID 또는 Android 패키지명. `list_apps`로 확인 가능 |
| `deviceId` | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택                  |

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
- `appId`는 영문·숫자·점·밑줄·하이픈만 허용됩니다.

---

## get_orientation

현재 화면 방향(portrait/landscape)과 플랫폼 raw 값을 조회합니다. **앱 연결 불필요.**

#### Parameters

| Parameter  | Type                 | Required | Description                                 |
| ---------- | -------------------- | -------- | ------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                 |
| `deviceId` | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

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

화면 방향을 portrait 또는 landscape로 설정합니다.

#### Parameters

| Parameter     | Type                        | Required | Description                                 |
| ------------- | --------------------------- | -------- | ------------------------------------------- |
| `platform`    | `"ios" \| "android"`        | **Yes**  | 대상 플랫폼                                 |
| `orientation` | `"portrait" \| "landscape"` | **Yes**  | 원하는 방향                                 |
| `deviceId`    | `string`                    | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

#### Example

```json
// Request
{
  "tool": "set_orientation",
  "arguments": { "platform": "android", "orientation": "landscape" }
}
```

#### Tips

- **Android**: `user_rotation` 0(portrait) / 1(landscape) 설정.
- **iOS**: 시뮬레이터만 지원. 실기기에서는 호출 시 에러를 반환합니다.

---

## get_screen_size

화면 크기(가로·세로 px)를 조회합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                 |
| ---------- | -------------------- | -------- | ------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                 |
| `deviceId` | `string`             | No       | 디바이스 ID. 단일 디바이스인 경우 자동 선택 |

#### Example

```json
// Request
{ "tool": "get_screen_size", "arguments": { "platform": "android" } }

// Response
{ "width": 1920, "height": 1200, "unit": "px" }
```

#### Tips

- **Android**: `wm size`로 물리 픽셀 반환. 앱 연결 불필요.
- **iOS**: 앱이 연결된 경우에만 `getScreenInfo()`로 반환. 미연결 시 "not supported" 에러.
