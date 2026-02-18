# 접근성 감사

접근성 감사를 실행하고, 위반 사항을 식별하며, 수정 사항을 검증하는 단계별 워크플로우입니다.

## 시나리오

릴리스 전에 앱이 기본적인 접근성 표준을 충족하는지 확인하고자 합니다 — 모든 인터랙티브 요소에 레이블이 있는지, 이미지에 대체 텍스트가 있는지, 터치 영역이 충분히 큰지 확인합니다.

## 1단계: 초기 감사 실행

```json
{ "tool": "accessibility_audit" }
```

**응답 예시:**

```json
{
  "violations": [
    {
      "rule": "pressable-needs-label",
      "severity": "error",
      "selector": "#close-btn",
      "message": "Pressable at #close-btn has no accessibilityLabel"
    },
    {
      "rule": "image-needs-alt",
      "severity": "error",
      "selector": "#avatar-image",
      "message": "Image at #avatar-image has no accessibilityLabel or alt prop"
    },
    {
      "rule": "touch-target-size",
      "severity": "warning",
      "selector": "#help-link",
      "message": "Touch target at #help-link is 32×28 points (minimum: 44×44)"
    },
    {
      "rule": "missing-role",
      "severity": "warning",
      "selector": "#tab-home",
      "message": "Interactive element at #tab-home has no accessibilityRole"
    }
  ],
  "summary": { "errors": 2, "warnings": 2, "passes": 38 }
}
```

## 2단계: 수정 우선순위 결정

**에러**를 먼저 처리합니다 — 스크린 리더 사용자에게 가장 큰 영향을 미칩니다:

1. `#close-btn`의 `pressable-needs-label` — `accessibilityLabel="Close"` 추가
2. `#avatar-image`의 `image-needs-alt` — `accessibilityLabel="User avatar"` 추가

그 다음 **경고**를 처리합니다:

3. `#help-link`의 `touch-target-size` — 패딩 또는 `minWidth`/`minHeight`를 44pt로 증가
4. `#tab-home`의 `missing-role` — `accessibilityRole="tab"` 추가

## 3단계: 특정 요소 검사

플래그된 요소의 상세 정보를 확인합니다:

```json
{
  "tool": "query_selector",
  "arguments": { "selector": "#close-btn" }
}
```

**응답:**

```json
{
  "uid": "close-btn",
  "type": "Pressable",
  "measure": { "pageX": 330, "pageY": 50, "width": 30, "height": 30 }
}
```

닫기 버튼이 30x30 포인트에 불과하다는 것을 확인할 수 있습니다 — `touch-target-size` 문제이기도 합니다.

## 4단계: 코드 수정

소스 코드에 수정 사항을 적용합니다:

```jsx
// Before
<Pressable testID="close-btn" onPress={onClose}>
  <Icon name="close" />
</Pressable>

// After
<Pressable
  testID="close-btn"
  onPress={onClose}
  accessibilityLabel="Close"
  accessibilityRole="button"
  style={{ minWidth: 44, minHeight: 44 }}
>
  <Icon name="close" />
</Pressable>
```

## 5단계: 감사 재실행

수정 후 앱을 리로드하고 감사를 다시 실행합니다:

```json
{ "tool": "accessibility_audit" }
```

**예상 응답:**

```json
{
  "violations": [],
  "summary": { "errors": 0, "warnings": 0, "passes": 42 }
}
```

## 6단계: 다른 화면 감사

각 화면으로 이동하여 감사를 반복합니다:

```json
{
  "tool": "open_deeplink",
  "arguments": { "platform": "ios", "url": "myapp://settings" }
}

{ "tool": "accessibility_audit" }
```

## 요약

| 단계 | 도구                                    | 목적                           |
| ---- | --------------------------------------- | ------------------------------ |
| 1    | `accessibility_audit`                   | 초기 감사 실행                 |
| 2    | —                                       | 경고보다 에러를 우선 처리      |
| 3    | `query_selector`                        | 플래그된 요소 검사             |
| 4    | —                                       | 코드 수정 (레이블, 역할, 크기) |
| 5    | `accessibility_audit`                   | 모든 위반 사항 해결 확인       |
| 6    | `open_deeplink` + `accessibility_audit` | 나머지 화면 감사               |
