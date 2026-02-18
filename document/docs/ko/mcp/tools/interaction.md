# Interaction

화면 탭, 스와이프, 텍스트 입력, 키 이벤트 전송, 하드웨어 버튼 누르기, 스크롤을 위한 도구입니다.

## tap

화면의 특정 좌표를 탭합니다. `duration`을 통해 롱 프레스를 지원합니다.

#### Parameters

| Parameter        | Type                 | Required | Description                                            |
| ---------------- | -------------------- | -------- | ------------------------------------------------------ |
| `platform`       | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                            |
| `x`              | `number`             | **Yes**  | X 좌표 (포인트/dp). Android에서 픽셀로 자동 변환       |
| `y`              | `number`             | **Yes**  | Y 좌표 (포인트/dp). Android에서 픽셀로 자동 변환       |
| `duration`       | `number`             | No       | 롱 프레스 시 누르고 있는 시간 (ms). 생략하면 일반 탭   |
| `deviceId`       | `string`             | No       | 디바이스 ID                                            |
| `iosOrientation` | `number`             | No       | iOS 방향 (1–4). 자동 감지를 건너뜀. 1,2=세로, 3,4=가로 |

#### Example

```json
// 버튼 탭 (query_selector로 좌표를 얻은 후)
{ "tool": "tap", "arguments": { "platform": "ios", "x": 187, "y": 604 } }

// 롱 프레스 (500ms)
{ "tool": "tap", "arguments": { "platform": "android", "x": 200, "y": 300, "duration": 500 } }
```

#### Tips

- **일반적인 워크플로우**: `query_selector` → `measure` 얻기 → 중심점 계산 (`pageX + width/2`, `pageY + height/2`) → `tap`.
- 좌표는 픽셀이 아닌 **포인트** (dp) 단위입니다. Android 픽셀 변환은 자동으로 처리됩니다.
- 가로 모드에서 자동 감지가 실패할 경우 `iosOrientation`을 사용하세요.

---

## swipe

한 지점에서 다른 지점으로 스와이프합니다. 스크롤, 드로어 열기, 요소 닫기 등에 유용합니다.

#### Parameters

| Parameter        | Type                 | Required | Description                          |
| ---------------- | -------------------- | -------- | ------------------------------------ |
| `platform`       | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                          |
| `x1`             | `number`             | **Yes**  | 시작 X 좌표 (포인트/dp)              |
| `y1`             | `number`             | **Yes**  | 시작 Y 좌표 (포인트/dp)              |
| `x2`             | `number`             | **Yes**  | 끝 X 좌표 (포인트/dp)                |
| `y2`             | `number`             | **Yes**  | 끝 Y 좌표 (포인트/dp)                |
| `duration`       | `number`             | No       | 스와이프 지속 시간 (ms). 기본값: 300 |
| `deviceId`       | `string`             | No       | 디바이스 ID                          |
| `iosOrientation` | `number`             | No       | iOS 방향 (1–4)                       |

#### Example

```json
// 아래로 스크롤
{
  "tool": "swipe",
  "arguments": { "platform": "ios", "x1": 187, "y1": 600, "x2": 187, "y2": 200 }
}

// 왼쪽 드로어 열기
{
  "tool": "swipe",
  "arguments": { "platform": "android", "x1": 10, "y1": 400, "x2": 300, "y2": 400 }
}
```

#### Tips

- 세로 스크롤: `x1 = x2`를 유지하고 `y1`과 `y2`를 변경합니다.
- `duration` 값이 클수록 느린 스와이프가 됩니다 (드래그 작업에 유용).
- 긴 목록에서 특정 요소를 찾아야 할 때는 `scroll_until_visible` 사용을 권장합니다.

---

## input_text

현재 포커스된 입력 필드에 텍스트를 입력합니다. **ASCII 전용** — 유니코드/한글은 `type_text`를 사용하세요.

#### Parameters

| Parameter  | Type                 | Required | Description                      |
| ---------- | -------------------- | -------- | -------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                      |
| `text`     | `string`             | **Yes**  | 입력할 텍스트. ASCII 문자만 가능 |
| `deviceId` | `string`             | No       | 디바이스 ID                      |

#### Example

```json
// 포커스된 입력 필드에 텍스트 입력
{
  "tool": "input_text",
  "arguments": { "platform": "ios", "text": "hello@example.com" }
}
```

#### Tips

- 입력 필드에 먼저 포커스가 되어 있어야 합니다 (입력 전에 해당 필드를 탭하세요).
- Android에서 특수 문자는 자동으로 이스케이프 처리됩니다.
- ASCII가 아닌 텍스트 (한글, 이모지 등)는 `type_text`를 대신 사용하세요.

---

## type_text

UID를 지정하여 TextInput에 텍스트를 입력합니다. 한글, 이모지 등 **유니코드**를 지원합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                |
| ---------- | -------------------- | -------- | ---------------------------------------------------------- |
| `uid`      | `string`             | **Yes**  | TextInput의 testID 또는 경로. `query_selector`로 먼저 확인 |
| `text`     | `string`             | **Yes**  | 입력할 텍스트 (유니코드 지원)                              |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                                |
| `deviceId` | `string`             | No       | 대상 디바이스                                              |

#### Example

```json
// 한글 텍스트 입력
{
  "tool": "type_text",
  "arguments": { "uid": "search-input", "text": "서울 맛집" }
}
```

#### Tips

- `input_text`와 달리 필드에 포커스가 없어도 됩니다 — UID로 직접 대상을 지정합니다.
- 내부적으로 런타임을 통해 TextInput의 `onChangeText` + `setNativeProps`를 호출합니다.
- 먼저 `query_selector`로 UID를 확인하세요: `query_selector({ selector: "TextInput" })`.

---

## input_key

시뮬레이터/디바이스에 키코드를 전송합니다.

#### Parameters

| Parameter  | Type                 | Required | Description   |
| ---------- | -------------------- | -------- | ------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼   |
| `keycode`  | `number`             | **Yes**  | 전송할 키코드 |
| `deviceId` | `string`             | No       | 디바이스 ID   |

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
// Enter 키를 눌러 폼 제출
{ "tool": "input_key", "arguments": { "platform": "android", "keycode": 66 } }

// iOS에서 Backspace 누르기
{ "tool": "input_key", "arguments": { "platform": "ios", "keycode": 42 } }
```

---

## press_button

디바이스의 물리/하드웨어 버튼을 누릅니다.

#### Parameters

| Parameter  | Type                 | Required | Description                     |
| ---------- | -------------------- | -------- | ------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                     |
| `button`   | `string`             | **Yes**  | 버튼 이름 (아래 표 참조)        |
| `duration` | `number`             | No       | 누르고 있는 시간 (초). iOS 전용 |
| `deviceId` | `string`             | No       | 디바이스 ID                     |

#### Available Buttons

| Platform | Buttons                                                                                   |
| -------- | ----------------------------------------------------------------------------------------- |
| Android  | `HOME`, `BACK`, `MENU`, `APP_SWITCH`, `POWER`, `VOLUME_UP`, `VOLUME_DOWN`, `ENTER`, `DEL` |
| iOS      | `HOME`, `LOCK`, `SIDE_BUTTON`                                                             |

#### Example

```json
// 홈 화면으로 이동
{ "tool": "press_button", "arguments": { "platform": "android", "button": "HOME" } }

// iOS에서 사이드 버튼 길게 누르기 (2초)
{ "tool": "press_button", "arguments": { "platform": "ios", "button": "SIDE_BUTTON", "duration": 2 } }
```

---

## scroll_until_visible

대상 요소가 화면에 나타날 때까지 스크롤합니다. `query_selector` + `swipe`를 반복 실행하는 방식입니다.

#### Parameters

| Parameter            | Type                                  | Required | Description                                             |
| -------------------- | ------------------------------------- | -------- | ------------------------------------------------------- |
| `selector`           | `string`                              | **Yes**  | 찾을 요소의 셀렉터                                      |
| `platform`           | `"ios" \| "android"`                  | **Yes**  | 대상 플랫폼                                             |
| `direction`          | `"up" \| "down" \| "left" \| "right"` | No       | 스크롤 방향. 기본값: `"down"`                           |
| `maxScrolls`         | `number`                              | No       | 최대 스크롤 시도 횟수. 기본값: 10                       |
| `scrollableSelector` | `string`                              | No       | 스크롤 컨테이너의 셀렉터. 생략하면 화면 중앙에서 스크롤 |
| `deviceId`           | `string`                              | No       | 디바이스 ID                                             |
| `iosOrientation`     | `number`                              | No       | iOS 방향 (1–4)                                          |

#### Example

```json
// 아래로 스크롤하여 요소 찾기
{
  "tool": "scroll_until_visible",
  "arguments": {
    "platform": "android",
    "selector": "#item-42",
    "direction": "down",
    "maxScrolls": 15
  }
}

// 응답
{
  "pass": true,
  "scrollCount": 3,
  "element": { "uid": "item-42", "measure": { "pageX": 0, "pageY": 450, "width": 375, "height": 60 } }
}
```

#### Tips

- 화면에 여러 스크롤 컨테이너가 있을 때 `scrollableSelector`를 사용하세요.
- 요소를 찾은 후 반환된 좌표를 사용하여 바로 `tap`할 수 있습니다.
- `pass`가 `false`이면 `maxScrolls` 횟수 내에 요소를 찾지 못한 것입니다.

---

## switch_keyboard

시뮬레이터/에뮬레이터에서 활성 키보드를 전환합니다.

#### Parameters

| Parameter     | Type                          | Required | Description                                                                                            |
| ------------- | ----------------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `platform`    | `"ios" \| "android"`          | **Yes**  | 대상 플랫폼                                                                                            |
| `action`      | `"list" \| "get" \| "switch"` | **Yes**  | `list`: 사용 가능한 키보드 표시. `get`: 현재 키보드 표시. `switch`: 전환 (iOS) 또는 IME 설정 (Android) |
| `keyboard_id` | `string`                      | No       | Android 전용. 전환할 IME ID. `action=list`로 사용 가능한 ID 확인                                       |

#### Example

```json
// 사용 가능한 키보드 목록 조회
{ "tool": "switch_keyboard", "arguments": { "platform": "android", "action": "list" } }

// Android에서 특정 IME로 전환
{
  "tool": "switch_keyboard",
  "arguments": { "platform": "android", "action": "switch", "keyboard_id": "com.google.android.inputmethod.korean/.KoreanIME" }
}
```

#### Tips

- iOS: `switch`는 Ctrl+Space를 전송하여 키보드를 전환합니다.
- 올바른 키보드 레이아웃을 위해 `input_text` 사용 **전에** 키보드를 전환하세요.
