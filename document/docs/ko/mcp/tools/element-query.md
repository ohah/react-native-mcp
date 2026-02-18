# Element Query

React Native 컴포넌트 트리에서 요소를 찾고, 앱 또는 WebView 컨텍스트에서 JavaScript를 실행하는 도구입니다.

## query_selector

React Fiber 트리에서 셀렉터와 일치하는 첫 번째 요소를 찾습니다. UID, 타입, 측정값(위치 + 크기)을 반환합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                              |
| ---------- | -------------------- | -------- | ------------------------------------------------------------------------ |
| `selector` | `string`             | **Yes**  | RN Fiber 트리용 셀렉터 ([Selector Syntax](./index#selector-syntax) 참조) |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                                              |
| `deviceId` | `string`             | No       | 대상 디바이스                                                            |

#### Example

```json
// testID로 찾기
{ "tool": "query_selector", "arguments": { "selector": "#submit-btn" } }

// 텍스트 내용으로 찾기
{ "tool": "query_selector", "arguments": { "selector": ":text(\"Login\")" } }

// 계층 구조로 찾기
{ "tool": "query_selector", "arguments": { "selector": "ScrollView > View > Text" } }

// 응답
{
  "uid": "submit-btn",
  "type": "View",
  "testID": "submit-btn",
  "measure": { "pageX": 120, "pageY": 580, "width": 200, "height": 48 }
}
```

#### Tips

- 대부분의 인터랙션 워크플로우의 **시작점**입니다: `query_selector` -> 좌표 획득 -> `tap`.
- 요소 중앙을 탭하려면: `x = pageX + width/2`, `y = pageY + height/2`.
- UID는 사전에 알 수 없으므로, 항상 `query_selector`를 먼저 호출하여 확인해야 합니다.

---

## query_selector_all

셀렉터와 일치하는 **모든** 요소를 찾습니다. 측정값이 포함된 배열을 반환합니다.

#### Parameters

| Parameter  | Type                 | Required | Description            |
| ---------- | -------------------- | -------- | ---------------------- |
| `selector` | `string`             | **Yes**  | RN Fiber 트리용 셀렉터 |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼            |
| `deviceId` | `string`             | No       | 대상 디바이스          |

#### Example

```json
// 모든 리스트 항목 찾기
{ "tool": "query_selector_all", "arguments": { "selector": "#list-item" } }

// 응답
[
  { "uid": "list-item-0", "type": "View", "measure": { "pageX": 0, "pageY": 100, "width": 375, "height": 60 } },
  { "uid": "list-item-1", "type": "View", "measure": { "pageX": 0, "pageY": 160, "width": 375, "height": 60 } }
]
```

#### Tips

- 요소 하나만 필요할 때는 `query_selector`를 사용하세요.
- 리스트 순회, 화면에 보이는 항목 개수 확인, 여러 일치 항목 반복 처리 등에 활용합니다.

---

## evaluate_script

앱의 런타임 컨텍스트에서 JavaScript를 실행합니다. `measureView(uid)`를 사용하여 탭/스와이프 좌표를 얻을 수 있습니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                                  |
| ---------- | -------------------- | -------- | ---------------------------------------------------------------------------- |
| `function` | `string`             | **Yes**  | JS 함수 문자열. 예: `"() => measureView('my-btn')"`. `require()`는 사용 불가 |
| `args`     | `array`              | No       | 함수에 전달되는 인자                                                         |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                                                  |
| `deviceId` | `string`             | No       | 대상 디바이스                                                                |

#### Example

```json
// UID로 뷰 측정
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "(uid) => measureView(uid)",
    "args": ["submit-btn"]
  }
}

// 등록된 WebView ID 조회
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "() => getRegisteredWebViewIds()"
  }
}

// 앱 전역 변수 접근
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "() => ({ width: globalThis.screen?.width, height: globalThis.screen?.height })"
  }
}
```

#### Tips

- `measureView(uid)`는 `{ pageX, pageY, width, height }`를 반환하며, 탭 좌표 계산에 유용합니다.
- `require()`는 **사용할 수 없습니다**. 전역 변수와 내장 MCP 헬퍼만 접근 가능합니다.
- 함수는 try-catch로 감싸져 WebSocket을 통해 실행됩니다.

---

## webview_evaluate_script

앱 내 WebView에서 JavaScript를 실행합니다. DOM 조작, 폼 입력, 웹 콘텐츠 읽기 등에 유용합니다.

#### Parameters

| Parameter   | Type                 | Required | Description                                                                       |
| ----------- | -------------------- | -------- | --------------------------------------------------------------------------------- |
| `webViewId` | `string`             | **Yes**  | WebView ID. `evaluate_script(() => getRegisteredWebViewIds())`로 확인 가능        |
| `script`    | `string`             | **Yes**  | WebView에서 실행할 JS (DOM 쿼리, 클릭 등). 결과를 반환하려면 값으로 평가되어야 함 |
| `platform`  | `"ios" \| "android"` | No       | 대상 플랫폼                                                                       |
| `deviceId`  | `string`             | No       | 대상 디바이스                                                                     |

#### Example

```json
// 먼저 WebView ID 조회
{
  "tool": "evaluate_script",
  "arguments": { "function": "() => getRegisteredWebViewIds()" }
}
// 응답: ["webview-0"]

// WebView 내부의 버튼 클릭
{
  "tool": "webview_evaluate_script",
  "arguments": {
    "webViewId": "webview-0",
    "script": "document.querySelector('#login-btn').click(); 'clicked'"
  }
}
```

#### Tips

- WebView DOM 인터랙션에는 `tap`보다 이 도구를 사용하세요 -- 더 빠르고 안정적입니다.
- WebView는 babel 플러그인에 의해 자동 등록됩니다. `getRegisteredWebViewIds()`로 사용 가능한 ID를 확인하세요.
- 결과를 반환하려면 스크립트가 값으로 평가되어야 합니다. 문자열이나 표현식으로 끝내세요.
