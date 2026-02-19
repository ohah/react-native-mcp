# UI 디버깅

컴포넌트 트리 검사, 요소 쿼리, 상태 검사를 활용하여 UI 문제를 진단하는 단계별 워크플로우입니다.

## 시나리오

사용자가 상품 상세 화면에서 "Add to Cart" 버튼이 반응하지 않는다고 보고했습니다. 원인을 조사해 봅시다.

## 1단계: 스냅샷 촬영

먼저 컴포넌트 트리를 캡처하여 현재 화면 구조를 파악합니다.

```json
{ "tool": "take_snapshot", "arguments": { "maxDepth": 15 } }
```

전체 컴포넌트 트리가 UID, 타입, testID, 텍스트 내용과 함께 반환됩니다. 트리 출력에서 해당 버튼을 찾아보세요.

## 2단계: 버튼 찾기

`query_selector`를 사용하여 버튼 요소를 찾고 측정값을 가져옵니다.

```json
{ "tool": "query_selector", "arguments": { "selector": ":text(\"Add to Cart\")" } }
```

**응답 예시:**

```json
{
  "uid": "add-to-cart-btn",
  "type": "Pressable",
  "measure": { "pageX": 20, "pageY": 680, "width": 335, "height": 48 }
}
```

버튼이 발견되면 다음을 확인하세요:

- 화면 밖에 위치해 있는가? (`pageY`가 화면 높이를 초과)
- 크기가 0인가? (`width: 0` 또는 `height: 0`)
- 다른 요소에 의해 가려져 있는가?

## 3단계: 겹치는 요소 확인

버튼이 존재하지만 탭에 반응하지 않는다면, 무언가가 위를 덮고 있을 수 있습니다. 동일한 위치의 요소를 조회합니다.

```json
{
  "tool": "evaluate_script",
  "arguments": {
    "function": "() => measureView('add-to-cart-btn')"
  }
}
```

그런 다음 `describe_ui`를 사용하여 해당 지점의 네이티브 접근성 트리를 확인합니다:

```json
{
  "tool": "describe_ui",
  "arguments": { "platform": "ios", "mode": "point", "x": 187, "y": 704 }
}
```

## 4단계: 컴포넌트 상태 검사

컴포넌트의 내부 상태를 확인하여 비활성화 상태이거나 로딩 중인지 확인합니다.

```json
{
  "tool": "inspect_state",
  "arguments": { "selector": "#add-to-cart-btn" }
}
```

**응답 예시:**

```json
{
  "component": "AddToCartButton",
  "hooks": [
    { "index": 0, "type": "useState", "value": true },
    { "index": 1, "type": "useState", "value": "out_of_stock" }
  ]
}
```

원인을 찾았습니다 -- hook index 1이 `"out_of_stock"`을 나타내고 있으며, 이것이 버튼을 비활성화시키고 있을 가능성이 높습니다.

## 5단계: 상태 변화 추적

앱과 상호작용하면서 상태 변화를 모니터링하여 흐름을 파악합니다.

```json
{ "tool": "clear", "arguments": { "target": "state_changes" } }
```

이제 앱과 상호작용(화면 이동, 탭 등)한 후 변경 사항을 확인합니다:

```json
{
  "tool": "get_state_changes",
  "arguments": { "component": "AddToCartButton", "limit": 10 }
}
```

## 6단계: 콘솔 오류 확인

콘솔에서 관련 오류 메시지를 확인합니다.

```json
{
  "tool": "list_console_messages",
  "arguments": { "level": "error", "limit": 10 }
}
```

## 요약

| 단계 | 도구                    | 목적                                   |
| ---- | ----------------------- | -------------------------------------- |
| 1    | `take_snapshot`         | 컴포넌트 트리 전체 구조 파악           |
| 2    | `query_selector`        | 특정 요소 찾기 및 측정값 확인          |
| 3    | `describe_ui`           | 특정 좌표의 네이티브 뷰 계층 구조 확인 |
| 4    | `inspect_state`         | React 상태 훅 검사                     |
| 5    | `get_state_changes`     | 시간에 따른 상태 변화 추적             |
| 6    | `list_console_messages` | 오류 로그 확인                         |
