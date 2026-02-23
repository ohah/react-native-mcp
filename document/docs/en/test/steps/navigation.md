# Navigation & Device

Steps for pressing buttons, navigating back/home, opening deep links, setting GPS location, and clearing app state.

## pressButton

Press a hardware or software button.

#### Parameters

| Field  | Type   | Required | Description                     |
| ------ | ------ | -------- | ------------------------------- |
| button | string | Yes      | Button id (e.g. `home`, `back`) |

#### Example

```yaml
- pressButton:
    button: back
```

---

## back

Press the back button. Shorthand for `pressButton: { button: BACK }`.

No parameters.

#### Example

```yaml
- back:
```

---

## home

Press the home button. Shorthand for `pressButton: { button: HOME }`.

No parameters.

#### Example

```yaml
- home:
```

---

## hideKeyboard

Dismiss the keyboard. Sends Escape key (HID 41) on iOS and BACK on Android.

No parameters.

#### Example

```yaml
- hideKeyboard:
```

---

## openDeepLink

Open a deep link.

#### Parameters

| Field | Type   | Required | Description   |
| ----- | ------ | -------- | ------------- |
| url   | string | Yes      | Deep link URL |

#### Example

```yaml
- openDeepLink:
    url: myapp://screen/settings
```

---

## setLocation

Set GPS location on the simulator (iOS) or emulator (Android).

#### Parameters

| Field     | Type   | Required | Description          |
| --------- | ------ | -------- | -------------------- |
| latitude  | number | Yes      | Latitude (-90–90)    |
| longitude | number | Yes      | Longitude (-180–180) |

#### Example

```yaml
- setLocation:
    latitude: 37.5665
    longitude: 126.978
```

#### Tips

- **iOS**: All simulators supported (`idb set-location`).
- **Android**: Emulator only. `adb emu geo fix` does not work on physical devices.

---

## clearState

Clear app data or reset permissions.

#### Parameters

| Field   | Type   | Required | Description                       |
| ------- | ------ | -------- | --------------------------------- |
| (value) | string | Yes      | iOS: bundle ID. Android: package. |

#### Example

```yaml
- clearState: org.reactnativemcp.demo
```

#### Tips

| Platform    | Behavior                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| **iOS**     | `simctl privacy reset all` — resets permissions only. App sandbox (documents, caches) is not cleared. Full reset requires uninstall + reinstall. |
| **Android** | `pm clear` — clears all app data (AsyncStorage, SharedPreferences, etc.).                                                                        |
