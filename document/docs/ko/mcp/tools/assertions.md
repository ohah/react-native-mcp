# Assertions

텍스트 내용, 요소 가시성, 요소 개수를 검증하는 도구입니다. 모든 assertion은 비동기 UI 업데이트를 위해 `timeoutMs`를 사용한 폴링을 지원합니다.

## assert_text

화면에 텍스트가 존재하는지 확인합니다.

#### Parameters

| Parameter    | Type                 | Required | Description                                                                          |
| ------------ | -------------------- | -------- | ------------------------------------------------------------------------------------ |
| `text`       | `string`             | **Yes**  | 존재 여부를 확인할 텍스트 부분 문자열                                                |
| `selector`   | `string`             | No       | 검색 범위를 좁히기 위한 셀렉터                                                       |
| `timeoutMs`  | `number`             | No       | 최대 대기 시간(ms). `0` = 단일 확인, `>0` = 통과 또는 타임아웃까지 폴링. 기본값: `0` |
| `intervalMs` | `number`             | No       | 폴링 간격(ms). `timeoutMs > 0`일 때만 사용됨. 기본값: `300`                          |
| `platform`   | `"ios" \| "android"` | No       | 대상 플랫폼                                                                          |
| `deviceId`   | `string`             | No       | 대상 디바이스                                                                        |

#### Example

```json
// 단순 텍스트 확인
{ "tool": "assert_text", "arguments": { "text": "Welcome" } }

// 범위를 지정한 텍스트 확인
{ "tool": "assert_text", "arguments": { "text": "Error", "selector": "#error-banner" } }

// 텍스트가 나타날 때까지 폴링 (최대 5초)
{ "tool": "assert_text", "arguments": { "text": "Order confirmed", "timeoutMs": 5000 } }

// 응답
{ "pass": true, "message": "Text \"Welcome\" found on screen" }
```

#### Tips

- **부분 문자열**로 매칭됩니다 — `"Welcome"`은 `"Welcome back, John"`과 매칭됩니다.
- 동일한 텍스트가 여러 곳에 나타날 때 오탐을 방지하려면 `selector`를 사용하세요.
- API 호출, 애니메이션 등 비동기 작업 후에 나타나는 요소에는 `timeoutMs`를 사용하세요.

---

## assert_visible

셀렉터와 일치하는 요소가 화면에 표시되는지 확인합니다.

#### Parameters

| Parameter    | Type                 | Required | Description                     |
| ------------ | -------------------- | -------- | ------------------------------- |
| `selector`   | `string`             | **Yes**  | 가시성을 확인할 셀렉터          |
| `timeoutMs`  | `number`             | No       | 최대 대기 시간(ms). 기본값: `0` |
| `intervalMs` | `number`             | No       | 폴링 간격(ms). 기본값: `300`    |
| `platform`   | `"ios" \| "android"` | No       | 대상 플랫폼                     |
| `deviceId`   | `string`             | No       | 대상 디바이스                   |

#### Example

```json
// 로딩 스피너가 표시되는지 확인
{ "tool": "assert_visible", "arguments": { "selector": "#loading-spinner" } }

// 모달이 나타날 때까지 대기
{
  "tool": "assert_visible",
  "arguments": { "selector": "#confirmation-modal", "timeoutMs": 3000 }
}

// 응답
{ "pass": true, "message": "Element matching '#confirmation-modal' is visible" }
```

#### Tips

- 네이티브 뷰 계층이 아닌 React Fiber 트리를 조회합니다.
- 요소가 트리에 존재하고 크기가 0이 아니면 "visible"로 판정됩니다.

---

## assert_not_visible

셀렉터와 일치하는 요소가 화면에 표시되지 **않는지** 확인합니다. 모달, 토스트, 로딩 인디케이터가 사라졌는지 검증할 때 유용합니다.

#### Parameters

| Parameter    | Type                 | Required | Description                        |
| ------------ | -------------------- | -------- | ---------------------------------- |
| `selector`   | `string`             | **Yes**  | 표시되지 않아야 하는 요소의 셀렉터 |
| `timeoutMs`  | `number`             | No       | 최대 대기 시간(ms). 기본값: `0`    |
| `intervalMs` | `number`             | No       | 폴링 간격(ms). 기본값: `300`       |
| `platform`   | `"ios" \| "android"` | No       | 대상 플랫폼                        |
| `deviceId`   | `string`             | No       | 대상 디바이스                      |

#### Example

```json
// 로딩 스피너가 사라졌는지 확인
{
  "tool": "assert_not_visible",
  "arguments": { "selector": "#loading-spinner", "timeoutMs": 5000 }
}

// 응답
{ "pass": true, "message": "Element matching '#loading-spinner' is not visible" }
```

#### Tips

- 사라지는 애니메이션이나 비동기 작업이 완료될 때까지 대기하려면 `timeoutMs`를 사용하세요.
- 요소가 트리에 존재하지 않거나 크기가 0이면 통과합니다.

---

## assert_element_count

셀렉터와 일치하는 요소의 개수를 확인합니다. 정확한 개수 또는 최소/최대 범위를 지원합니다.

#### Parameters

| Parameter       | Type                 | Required | Description                                                  |
| --------------- | -------------------- | -------- | ------------------------------------------------------------ |
| `selector`      | `string`             | **Yes**  | 일치하는 요소를 셀 셀렉터                                    |
| `expectedCount` | `number`             | No       | 기대하는 정확한 개수. `minCount`/`maxCount`와 함께 사용 불가 |
| `minCount`      | `number`             | No       | 최소 개수 (이상)                                             |
| `maxCount`      | `number`             | No       | 최대 개수 (이하)                                             |
| `timeoutMs`     | `number`             | No       | 최대 대기 시간(ms). 기본값: `0`                              |
| `intervalMs`    | `number`             | No       | 폴링 간격(ms). 기본값: `300`                                 |
| `platform`      | `"ios" \| "android"` | No       | 대상 플랫폼                                                  |
| `deviceId`      | `string`             | No       | 대상 디바이스                                                |

#### Example

```json
// 정확히 3개 항목
{
  "tool": "assert_element_count",
  "arguments": { "selector": ".list-item", "expectedCount": 3 }
}

// 최소 1개 항목
{
  "tool": "assert_element_count",
  "arguments": { "selector": "#cart-item", "minCount": 1 }
}

// 2개에서 5개 사이의 항목
{
  "tool": "assert_element_count",
  "arguments": { "selector": "#notification", "minCount": 2, "maxCount": 5 }
}

// 응답
{ "pass": true, "actualCount": 3, "message": "Found 3 elements matching '.list-item' (expected 3)" }
```

#### Tips

- 정확한 매칭에는 `expectedCount`를, 범위 확인에는 `minCount`/`maxCount`를 사용하세요.
- `expectedCount`와 `minCount`/`maxCount`는 상호 배타적입니다 — 함께 사용하지 마세요.
