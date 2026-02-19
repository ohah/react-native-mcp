# State Inspection

React 컴포넌트의 state hook을 검사하고, 시간에 따른 상태 변경을 추적하는 도구입니다.

## inspect_state

selector로 찾은 React 컴포넌트의 state hook을 검사합니다. `useState`, Zustand 등 hook 기반 상태 관리와 함께 동작합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                    |
| ---------- | -------------------- | -------- | -------------------------------------------------------------- |
| `selector` | `string`             | **Yes**  | 컴포넌트를 찾기 위한 selector (예: `CartScreen`, `#cart-view`) |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                                    |
| `deviceId` | `string`             | No       | 대상 디바이스                                                  |

#### Example

```json
// 컴포넌트의 state 검사
{
  "tool": "inspect_state",
  "arguments": { "selector": "#cart-view" }
}

// 응답
{
  "component": "CartScreen",
  "hooks": [
    { "index": 0, "type": "useState", "value": [{ "id": 1, "name": "Widget", "qty": 2 }] },
    { "index": 1, "type": "useState", "value": true },
    { "index": 2, "type": "useState", "value": "loading" }
  ]
}
```

#### Tips

- `selector`는 Fiber 트리에서 React 컴포넌트를 대상으로 합니다. `query_selector`와 동일한 문법을 사용합니다.
- hook의 `index`는 컴포넌트 소스 코드에서 `useState` 호출 순서에 해당합니다.
- `useState`, Zustand 스토어 등 hook 기반 상태 관리와 함께 동작합니다.
- 시각적 출력에만 의존하지 않고 내부 상태를 검증할 때 사용하세요.

---

## get_state_changes

시간에 따라 캡처된 상태 변경 내역을 조회합니다. 각 변경에 대해 이전 값과 다음 값을 보여줍니다.

#### Parameters

| Parameter   | Type                 | Required | Description                                           |
| ----------- | -------------------- | -------- | ----------------------------------------------------- |
| `component` | `string`             | No       | 컴포넌트 이름으로 필터링. 생략하면 모든 컴포넌트 대상 |
| `since`     | `number`             | No       | 이 타임스탬프(ms) 이후의 변경만 반환                  |
| `limit`     | `number`             | No       | 반환할 최대 변경 수. 기본값: `100`                    |
| `platform`  | `"ios" \| "android"` | No       | 대상 플랫폼                                           |
| `deviceId`  | `string`             | No       | 대상 디바이스                                         |

#### Example

```json
// 최근 상태 변경 전체 조회
{ "tool": "get_state_changes" }

// 컴포넌트별 필터링
{
  "tool": "get_state_changes",
  "arguments": { "component": "CartScreen", "limit": 10 }
}

// 응답
[
  {
    "id": 1,
    "timestamp": 1700000001234,
    "component": "CartScreen",
    "hookIndex": 0,
    "prev": [],
    "next": [{ "id": 1, "name": "Widget", "qty": 1 }]
  },
  {
    "id": 2,
    "timestamp": 1700000002000,
    "component": "CartScreen",
    "hookIndex": 0,
    "prev": [{ "id": 1, "name": "Widget", "qty": 1 }],
    "next": [{ "id": 1, "name": "Widget", "qty": 2 }]
  }
]
```

#### Tips

- 버퍼는 최대 **300**개의 상태 변경을 저장합니다. `clear`(target: `state_changes`)로 초기화할 수 있습니다.
- `since`를 사용하면 마지막 확인 이후의 새로운 변경만 가져올 수 있습니다.
- `inspect_state`와 함께 사용하면 현재 상태와 변경 이력을 종합적으로 파악할 수 있습니다.

상태 변경 버퍼를 비우려면 통합 **clear** 도구에 `target: "state_changes"`를 사용하세요.

```json
{ "tool": "clear", "arguments": { "target": "state_changes" } }
```

테스트 시나리오 시작 전에 호출하면 깨끗한 이력을 얻을 수 있습니다.
