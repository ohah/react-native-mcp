# 네트워크 모킹

API 응답을 모킹하고, 에러 상황을 시뮬레이션하며, 앱이 이를 올바르게 처리하는지 검증하는 단계별 워크플로우입니다.

## 시나리오

백엔드를 수정하지 않고, API가 에러를 반환하거나 응답이 느린 경우 앱이 어떻게 동작하는지 테스트하고 싶을 때 사용합니다.

## 1단계: 기존 상태 초기화

기존 모킹 설정과 네트워크 로그를 지워 깨끗한 상태에서 시작합니다.

```json
{ "tool": "clear_network_mocks" }
{ "tool": "clear_network_requests" }
```

## 2단계: 성공 응답 모킹

사용자 프로필 엔드포인트에 대한 모킹을 설정합니다.

```json
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/user/profile",
    "method": "GET",
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"id\":1,\"name\":\"Test User\",\"email\":\"test@example.com\"}"
  }
}
```

프로필 화면으로 이동한 후 모킹된 데이터가 표시되는지 확인합니다:

```json
{ "tool": "assert_text", "arguments": { "text": "Test User", "timeoutMs": 3000 } }
```

## 3단계: 서버 에러 시뮬레이션

성공 모킹을 제거하고 에러 모킹을 추가합니다.

```json
{ "tool": "clear_network_mocks" }

{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/user/profile",
    "method": "GET",
    "status": 500,
    "body": "{\"error\":\"Internal server error\"}"
  }
}
```

새로고침을 트리거하고 에러 처리가 올바르게 되는지 확인합니다:

```json
{ "tool": "assert_text", "arguments": { "text": "Something went wrong", "timeoutMs": 3000 } }
```

## 4단계: 느린 네트워크 시뮬레이션

지연 시간을 추가하여 로딩 상태를 테스트합니다.

```json
{ "tool": "clear_network_mocks" }

{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/user/profile",
    "delay": 3000,
    "body": "{\"id\":1,\"name\":\"Test User\"}"
  }
}
```

요청을 트리거하고 로딩 인디케이터가 표시되는지 확인합니다:

```json
{ "tool": "assert_visible", "arguments": { "selector": "#loading-spinner", "timeoutMs": 1000 } }
```

그런 다음 로딩 인디케이터가 사라지는지 확인합니다:

```json
{ "tool": "assert_not_visible", "arguments": { "selector": "#loading-spinner", "timeoutMs": 5000 } }
```

## 5단계: 모킹 히트 횟수 확인

모킹이 실제로 트리거되었는지 확인합니다.

```json
{ "tool": "list_network_mocks" }
```

**응답 예시:**

```json
[{ "id": 3, "urlPattern": "/api/user/profile", "status": 200, "hitCount": 1, "enabled": true }]
```

`hitCount: 1`은 모킹이 정확히 한 번 트리거되었음을 확인해 줍니다.

## 6단계: 실제 네트워크 트래픽 확인

디버깅을 위해 캡처된 네트워크 요청을 확인합니다.

```json
{
  "tool": "list_network_requests",
  "arguments": { "url": "/api/user", "limit": 5 }
}
```

## 7단계: 정리

테스트가 끝나면 반드시 모킹을 정리합니다.

```json
{ "tool": "clear_network_mocks" }
```

## 요약

| 단계 | 도구                            | 목적                     |
| ---- | ------------------------------- | ------------------------ |
| 1    | `clear_network_mocks`           | 초기 상태로 시작         |
| 2    | `set_network_mock`              | 성공 응답 모킹           |
| 3    | `set_network_mock` (status 500) | 에러 시뮬레이션          |
| 4    | `set_network_mock` (delay)      | 느린 네트워크 시뮬레이션 |
| 5    | `list_network_mocks`            | 모킹 히트 횟수 확인      |
| 6    | `list_network_requests`         | 실제 트래픽 확인         |
| 7    | `clear_network_mocks`           | 정리                     |
