# Interaction

Tools for tapping, swiping, typing text, sending key events, pressing hardware buttons, and scrolling.

## tap

Tap at a point on the screen. Supports long press via `duration`.

#### Parameters

| Parameter        | Type                 | Required | Description                                                           |
| ---------------- | -------------------- | -------- | --------------------------------------------------------------------- |
| `platform`       | `"ios" \| "android"` | **Yes**  | Target platform                                                       |
| `x`              | `number`             | **Yes**  | X in points (dp). Auto-converted to pixels on Android                 |
| `y`              | `number`             | **Yes**  | Y in points (dp). Auto-converted to pixels on Android                 |
| `duration`       | `number`             | No       | Hold duration in ms for long press. Omit for a regular tap            |
| `deviceId`       | `string`             | No       | Device ID                                                             |
| `iosOrientation` | `number`             | No       | iOS orientation (1–4). Skips auto-detect. 1,2=portrait, 3,4=landscape |

#### Example

```json
// Tap a button (after getting coords from query_selector)
{ "tool": "tap", "arguments": { "platform": "ios", "x": 187, "y": 604 } }

// Long press (500ms)
{ "tool": "tap", "arguments": { "platform": "android", "x": 200, "y": 300, "duration": 500 } }
```

#### Tips

- **Typical workflow**: `query_selector` → get `measure` → compute center (`pageX + width/2`, `pageY + height/2`) → `tap`.
- Coordinates are in **points** (dp), not pixels. Android pixel conversion is automatic.
- Use `iosOrientation` when auto-detection fails in landscape mode.

---

## swipe

Swipe from one point to another. Useful for scrolling, opening drawers, or dismissing elements.

#### Parameters

| Parameter        | Type                 | Required | Description                        |
| ---------------- | -------------------- | -------- | ---------------------------------- |
| `platform`       | `"ios" \| "android"` | **Yes**  | Target platform                    |
| `x1`             | `number`             | **Yes**  | Start X in points (dp)             |
| `y1`             | `number`             | **Yes**  | Start Y in points (dp)             |
| `x2`             | `number`             | **Yes**  | End X in points (dp)               |
| `y2`             | `number`             | **Yes**  | End Y in points (dp)               |
| `duration`       | `number`             | No       | Swipe duration in ms. Default: 300 |
| `deviceId`       | `string`             | No       | Device ID                          |
| `iosOrientation` | `number`             | No       | iOS orientation (1–4)              |

#### Example

```json
// Scroll down
{
  "tool": "swipe",
  "arguments": { "platform": "ios", "x1": 187, "y1": 600, "x2": 187, "y2": 200 }
}

// Open left drawer
{
  "tool": "swipe",
  "arguments": { "platform": "android", "x1": 10, "y1": 400, "x2": 300, "y2": 400 }
}
```

#### Tips

- For vertical scroll: keep `x1 = x2`, change `y1` and `y2`.
- Longer `duration` values produce slower swipes (useful for drag operations).
- Prefer `scroll_until_visible` when you need to find a specific element in a long list.

---

## input_text

Type text into the currently focused input. **ASCII only** — use `type_text` for Unicode/Korean.

#### Parameters

| Parameter  | Type                 | Required | Description                         |
| ---------- | -------------------- | -------- | ----------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform                     |
| `text`     | `string`             | **Yes**  | Text to type. ASCII characters only |
| `deviceId` | `string`             | No       | Device ID                           |

#### Example

```json
// Type into focused input
{
  "tool": "input_text",
  "arguments": { "platform": "ios", "text": "hello@example.com" }
}
```

#### Tips

- The input field must be focused first (tap on it before typing).
- Special characters are escaped automatically on Android.
- For non-ASCII text (Korean, emoji, etc.), use `type_text` instead.

---

## type_text

Type text into a TextInput by UID. Supports **Unicode** including Korean, emoji, etc.

#### Parameters

| Parameter  | Type                 | Required | Description                                                      |
| ---------- | -------------------- | -------- | ---------------------------------------------------------------- |
| `uid`      | `string`             | **Yes**  | testID or path of the TextInput. Get from `query_selector` first |
| `text`     | `string`             | **Yes**  | Text to type (supports Unicode)                                  |
| `platform` | `"ios" \| "android"` | No       | Target platform                                                  |
| `deviceId` | `string`             | No       | Target device                                                    |

#### Example

```json
// Type Korean text
{
  "tool": "type_text",
  "arguments": { "uid": "search-input", "text": "서울 맛집" }
}
```

#### Tips

- Unlike `input_text`, this doesn't require the field to be focused — it targets by UID directly.
- Internally calls `onChangeText` + `setNativeProps` on the TextInput via the runtime.
- Get the UID from `query_selector` first: `query_selector({ selector: "TextInput" })`.

---

## input_key

Send a keycode to the simulator/device.

#### Parameters

| Parameter  | Type                 | Required | Description     |
| ---------- | -------------------- | -------- | --------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform |
| `keycode`  | `number`             | **Yes**  | Keycode to send |
| `deviceId` | `string`             | No       | Device ID       |

#### Common Keycodes

| Key              | iOS | Android |
| ---------------- | --- | ------- |
| Return/Enter     | 40  | 66      |
| Backspace/Delete | 42  | 67      |
| Space            | 44  | 62      |
| Escape           | 41  | —       |
| Back             | —   | 4       |

#### Example

```json
// Press Enter to submit a form
{ "tool": "input_key", "arguments": { "platform": "android", "keycode": 66 } }

// Press Backspace on iOS
{ "tool": "input_key", "arguments": { "platform": "ios", "keycode": 42 } }
```

---

## press_button

Press a physical/hardware button on the device.

#### Parameters

| Parameter  | Type                 | Required | Description                        |
| ---------- | -------------------- | -------- | ---------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | Target platform                    |
| `button`   | `string`             | **Yes**  | Button name (see table below)      |
| `duration` | `number`             | No       | Hold duration in seconds. iOS only |
| `deviceId` | `string`             | No       | Device ID                          |

#### Available Buttons

| Platform | Buttons                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| Android  | `HOME`, `BACK`, `MENU`, `APP_SWITCH`, `POWER`, `VOLUME_UP`, `VOLUME_DOWN`, `ENTER`, `DEL` |
| iOS      | `HOME`, `LOCK`, `SIDE_BUTTON`                                                             |

#### Example

```json
// Go to home screen
{ "tool": "press_button", "arguments": { "platform": "android", "button": "HOME" } }

// Long press side button on iOS (2 seconds)
{ "tool": "press_button", "arguments": { "platform": "ios", "button": "SIDE_BUTTON", "duration": 2 } }
```

---

## scroll_until_visible

Scroll until a target element becomes visible. Combines `query_selector` + `swipe` in a loop.

#### Parameters

| Parameter            | Type                                  | Required | Description                                                          |
| -------------------- | ------------------------------------- | -------- | -------------------------------------------------------------------- |
| `selector`           | `string`                              | **Yes**  | Selector of the element to find                                      |
| `platform`           | `"ios" \| "android"`                  | **Yes**  | Target platform                                                      |
| `direction`          | `"up" \| "down" \| "left" \| "right"` | No       | Scroll direction. Default: `"down"`                                  |
| `maxScrolls`         | `number`                              | No       | Maximum scroll attempts. Default: 10                                 |
| `scrollableSelector` | `string`                              | No       | Selector for the scroll container. Omit to scroll from screen center |
| `deviceId`           | `string`                              | No       | Device ID                                                            |
| `iosOrientation`     | `number`                              | No       | iOS orientation (1–4)                                                |

#### Example

```json
// Scroll down to find an element
{
  "tool": "scroll_until_visible",
  "arguments": {
    "platform": "android",
    "selector": "#item-42",
    "direction": "down",
    "maxScrolls": 15
  }
}

// Response
{
  "pass": true,
  "scrollCount": 3,
  "element": { "uid": "item-42", "measure": { "pageX": 0, "pageY": 450, "width": 375, "height": 60 } }
}
```

#### Tips

- Use `scrollableSelector` when there are multiple scroll containers on screen.
- After finding the element, you can immediately `tap` using the returned coordinates.
- If `pass` is `false`, the element was not found within `maxScrolls` attempts.

---

## switch_keyboard

Switch the active keyboard on simulator/emulator.

#### Parameters

| Parameter     | Type                          | Required | Description                                                                                        |
| ------------- | ----------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `platform`    | `"ios" \| "android"`          | **Yes**  | Target platform                                                                                    |
| `action`      | `"list" \| "get" \| "switch"` | **Yes**  | `list`: show available keyboards. `get`: show current. `switch`: toggle (iOS) or set IME (Android) |
| `keyboard_id` | `string`                      | No       | Android only. IME ID to switch to. Use `action=list` to see available IDs                          |

#### Example

```json
// List available keyboards
{ "tool": "switch_keyboard", "arguments": { "platform": "android", "action": "list" } }

// Switch to a specific IME on Android
{
  "tool": "switch_keyboard",
  "arguments": { "platform": "android", "action": "switch", "keyboard_id": "com.google.android.inputmethod.korean/.KoreanIME" }
}
```

#### Tips

- iOS: `switch` sends Ctrl+Space to toggle between keyboards.
- Switch the keyboard **before** using `input_text` to ensure the correct layout.
