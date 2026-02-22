# Console & Network

앱에서 캡처된 콘솔 로그와 네트워크 요청을 검사하는 도구입니다.

## list_console_messages

앱에서 캡처된 `console.log/info/warn/error` 메시지를 조회합니다.

#### Parameters

| Parameter  | Type                                   | Required | Description                                               |
| ---------- | -------------------------------------- | -------- | --------------------------------------------------------- |
| `level`    | `"log" \| "info" \| "warn" \| "error"` | No       | 로그 레벨로 필터링합니다. 생략하면 모든 레벨을 반환합니다 |
| `since`    | `number`                               | No       | 이 타임스탬프(ms) 이후의 로그만 반환합니다                |
| `limit`    | `number`                               | No       | 반환할 최대 로그 수. 기본값: `100`                        |
| `platform` | `"ios" \| "android"`                   | No       | 대상 플랫폼                                               |
| `deviceId` | `string`                               | No       | 대상 디바이스                                             |

#### Example

```json
// 모든 에러 로그 조회
{
  "tool": "list_console_messages",
  "arguments": { "level": "error" }
}

// 최근 로그 조회 (최근 5초)
{
  "tool": "list_console_messages",
  "arguments": { "since": 1700000000000, "limit": 20 }
}

// 응답
[
  { "id": 1, "level": "error", "message": "Network request failed: timeout", "timestamp": 1700000001234 },
  { "id": 2, "level": "warn", "message": "Deprecated API usage", "timestamp": 1700000001500 }
]
```

#### Tips

- 콘솔 메시지는 MCP 서버에 버퍼링됩니다. `since`를 사용하면 마지막 조회 이후의 새로운 메시지만 가져올 수 있습니다.
- 테스트 시나리오 시작 전에 `clear`(target: `console`)로 버퍼를 초기화할 수 있습니다.

---

## list_network_requests

캡처된 XHR/fetch 요청을 요청 및 응답 세부 정보와 함께 조회합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                |
| ---------- | -------------------- | -------- | ------------------------------------------ |
| `url`      | `string`             | No       | URL 부분 문자열 필터                       |
| `method`   | `string`             | No       | HTTP 메서드 필터 (예: `GET`, `POST`)       |
| `status`   | `number`             | No       | 상태 코드 필터 (예: `200`, `404`)          |
| `since`    | `number`             | No       | 이 타임스탬프(ms) 이후의 요청만 반환합니다 |
| `limit`    | `number`             | No       | 반환할 최대 요청 수. 기본값: `50`          |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                |
| `deviceId` | `string`             | No       | 대상 디바이스                              |

#### Example

```json
// URL로 필터링
{
  "tool": "list_network_requests",
  "arguments": { "url": "/api/users" }
}

// 메서드와 상태 코드로 필터링
{
  "tool": "list_network_requests",
  "arguments": { "method": "POST", "status": 201 }
}

// 응답
[
  {
    "id": 1,
    "method": "GET",
    "url": "https://api.example.com/api/users",
    "status": 200,
    "statusText": "OK",
    "duration": 245,
    "state": "completed",
    "requestBody": null,
    "responseBody": "{\"users\":[...]}"
  }
]
```

#### Tips

- `fetch()`와 `XMLHttpRequest` 호출을 모두 캡처합니다.
- `url` 필터는 부분 문자열로 매칭되므로, 결과를 좁히는 데 유용합니다.
- `responseBody`는 문자열로 캡처됩니다. 큰 응답은 잘릴 수 있습니다.

- 테스트 시나리오 전에 `clear`(target: `network_requests`)로 버퍼를 비울 수 있습니다.

---

## clear

콘솔 로그, 네트워크 요청, 네트워크 모크, 상태 변경, 렌더 프로파일 데이터 중 하나의 메모리 버퍼를 비웁니다. 앱 데이터 초기화는 별도 도구 `clear_state`를 사용하세요.

#### Parameters

| 파라미터   | 타입                 | 필수   | 설명                                                                                            |
| ---------- | -------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| `target`   | `string`             | 예     | 다음 중 하나: `console`, `network_requests`, `network_mocks`, `state_changes`, `render_profile` |
| `platform` | `"ios" \| "android"` | 아니오 | 대상 플랫폼                                                                                     |
| `deviceId` | `string`             | 아니오 | 대상 디바이스                                                                                   |

#### Example

```json
// 테스트 전 콘솔 버퍼 비우기
{ "tool": "clear", "arguments": { "target": "console" } }

// 네트워크 모크 규칙 제거
{ "tool": "clear", "arguments": { "target": "network_mocks" } }

// 렌더 프로파일링 중지 및 데이터 비우기
{ "tool": "clear", "arguments": { "target": "render_profile" } }
```

#### Tips

- `console` — 캡처된 콘솔 메시지 비우기.
- `network_requests` — 요청/응답 버퍼 비우기.
- `network_mocks` — 모든 모크 규칙 제거.
- `state_changes` — 상태 변경 이력 비우기.
- `render_profile` — 프로파일링 중지 및 리포트 비우기.
- 앱 저장소·권한 초기화는 [디바이스 및 상태](./device)의 `clear_state`를 사용하세요.
