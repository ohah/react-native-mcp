# Network Mocking

백엔드를 수정하지 않고 API 응답을 모킹하기 위한 도구입니다. 매칭된 XHR/fetch 요청은 모킹된 응답을 직접 반환합니다.

## set_network_mock

네트워크 모킹 규칙을 추가합니다. 매칭되는 요청은 실제 네트워크를 거치지 않고 모킹된 응답을 반환합니다.

#### Parameters

| Parameter    | Type                 | Required | Description                                                  |
| ------------ | -------------------- | -------- | ------------------------------------------------------------ |
| `urlPattern` | `string`             | **Yes**  | 매칭할 URL 패턴 (부분 문자열 또는 정규식)                    |
| `isRegex`    | `boolean`            | No       | `urlPattern`이 정규식인 경우 `true`로 설정                   |
| `method`     | `string`             | No       | HTTP 메서드 필터. 생략 시 모든 메서드에 매칭                 |
| `status`     | `number`             | No       | 모킹 응답 상태 코드. 기본값: `200`                           |
| `statusText` | `string`             | No       | 모킹 응답 상태 텍스트                                        |
| `headers`    | `object`             | No       | 모킹 응답 헤더. 예: `{ "Content-Type": "application/json" }` |
| `body`       | `string`             | No       | 모킹 응답 본문                                               |
| `delay`      | `number`             | No       | 모킹 응답 반환 전 지연 시간 (ms)                             |
| `platform`   | `"ios" \| "android"` | No       | 대상 플랫폼                                                  |
| `deviceId`   | `string`             | No       | 대상 디바이스                                                |

#### Example

```json
// 성공적인 API 응답 모킹
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/users",
    "method": "GET",
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"users\":[{\"id\":1,\"name\":\"Alice\"}]}"
  }
}

// 서버 에러 시뮬레이션
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/checkout",
    "method": "POST",
    "status": 500,
    "body": "{\"error\":\"Internal server error\"}"
  }
}

// 느린 네트워크 시뮬레이션 (2초 지연)
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/products",
    "delay": 2000,
    "body": "{\"products\":[]}"
  }
}

// 정규식 패턴 매칭
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/users/\\d+",
    "isRegex": true,
    "body": "{\"id\":1,\"name\":\"Mock User\"}"
  }
}

// 응답
{ "id": 1, "urlPattern": "/api/users", "status": 200, "enabled": true }
```

#### Tips

- 모킹은 `fetch()`와 `XMLHttpRequest` 호출 모두를 인터셉트합니다.
- 기본적으로 부분 문자열 매칭이 사용됩니다. 복잡한 패턴에는 `isRegex: true`를 사용하세요.
- 모킹은 명시적으로 제거하거나 초기화하기 전까지 유지됩니다.
- `body`는 반드시 문자열이어야 합니다. JSON 응답의 경우 객체를 문자열로 변환하세요.

---

## list_network_mocks

활성화된 모든 네트워크 모킹 규칙을 조회합니다.

#### Parameters

| Parameter  | Type                 | Required | Description   |
| ---------- | -------------------- | -------- | ------------- |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼   |
| `deviceId` | `string`             | No       | 대상 디바이스 |

#### Example

```json
// 요청
{ "tool": "list_network_mocks" }

// 응답
[
  { "id": 1, "urlPattern": "/api/users", "isRegex": false, "method": "GET", "status": 200, "enabled": true, "hitCount": 3 },
  { "id": 2, "urlPattern": "/api/checkout", "isRegex": false, "method": "POST", "status": 500, "enabled": true, "hitCount": 0 }
]
```

#### Tips

- `hitCount`는 각 모킹에 매칭된 요청 수를 나타내며, 모킹이 정상적으로 작동했는지 확인하는 데 유용합니다.

---

## remove_network_mock

ID로 특정 네트워크 모킹 규칙을 제거합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                                           |
| ---------- | -------------------- | -------- | ------------------------------------------------------------------------------------- |
| `id`       | `number`             | **Yes**  | 제거할 모킹 규칙 ID (`list_network_mocks` 또는 `set_network_mock` 응답에서 확인 가능) |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                                                           |
| `deviceId` | `string`             | No       | 대상 디바이스                                                                         |

#### Example

```json
{ "tool": "remove_network_mock", "arguments": { "id": 1 } }
```

---

## clear_network_mocks

활성화된 모든 네트워크 모킹 규칙을 한번에 제거합니다.

#### Parameters

| Parameter  | Type                 | Required | Description   |
| ---------- | -------------------- | -------- | ------------- |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼   |
| `deviceId` | `string`             | No       | 대상 디바이스 |

#### Example

```json
{ "tool": "clear_network_mocks" }
```

#### Tips

- 테스트 시나리오 종료 후 호출하여 모킹이 다음 테스트에 영향을 주지 않도록 하세요.
