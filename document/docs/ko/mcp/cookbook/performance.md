# 성능 프로파일링

React 컴포넌트 렌더링을 프로파일링하고, 불필요한 리렌더를 찾아내며, 최적화 대상을 식별하는 단계별 워크플로우입니다.

## 시나리오

상품 목록 화면에서 스크롤할 때 버벅거림이 느껴집니다. 어떤 컴포넌트가 과도하게 리렌더되고 있는지, `React.memo`가 도움이 될 수 있는지 확인하려 합니다.

## Step 1: 프로파일링 시작

렌더 프로파일링을 시작합니다. 선택적으로 특정 컴포넌트만 필터링할 수 있습니다.

```json
{ "tool": "start_render_profile" }
```

또는 특정 컴포넌트에 집중할 수 있습니다:

```json
{
  "tool": "start_render_profile",
  "arguments": {
    "components": ["ProductCard", "PriceLabel", "ProductList", "Header"]
  }
}
```

## Step 2: 문제 상황 재현

상품 목록을 스크롤하여 리렌더를 발생시킵니다. `swipe`를 사용하여 스크롤을 시뮬레이션합니다:

```json
{
  "tool": "swipe",
  "arguments": { "platform": "ios", "x1": 187, "y1": 600, "x2": 187, "y2": 200 }
}
```

렌더 데이터를 충분히 수집하기 위해 여러 번 반복합니다:

```json
{
  "tool": "swipe",
  "arguments": { "platform": "ios", "x1": 187, "y1": 600, "x2": 187, "y2": 200 }
}
```

## Step 3: 렌더 리포트 확인

```json
{ "tool": "get_render_report" }
```

**응답 예시:**

```json
{
  "hotComponents": [
    { "component": "ProductCard", "renderCount": 48, "mountCount": 12 },
    { "component": "PriceLabel", "renderCount": 48, "mountCount": 12 },
    { "component": "Header", "renderCount": 6, "mountCount": 1 }
  ],
  "unnecessaryRenders": [
    {
      "component": "Header",
      "count": 5,
      "message": "Header re-rendered 5 times without prop changes — wrap with React.memo"
    },
    {
      "component": "PriceLabel",
      "count": 36,
      "message": "PriceLabel re-rendered 36 times without prop changes — wrap with React.memo"
    }
  ],
  "recentRenders": [
    { "component": "Header", "timestamp": 1700000001234, "trigger": "parent", "changedProps": [] },
    {
      "component": "ProductCard",
      "timestamp": 1700000001235,
      "trigger": "props",
      "changedProps": ["item"]
    }
  ]
}
```

## Step 4: 결과 분석

리포트를 통해 다음을 알 수 있습니다:

1. **`Header`** 가 props 변경 없이 5회 리렌더됨 → 부모 리렌더에 의해 트리거됨 → **`React.memo`로 감싸기**
2. **`PriceLabel`** 이 props 변경 없이 36회 리렌더됨 → 역시 `React.memo` 적용 대상
3. **`ProductCard`** 는 총 48회 렌더, 12회 마운트 — 리사이클링이 적용된 스크롤 목록에서 예상되는 정상적인 수치

## Step 5: 최적화 후 검증

`Header`와 `PriceLabel`에 `React.memo`를 적용한 후, 다시 프로파일링합니다:

```json
{ "tool": "clear", "arguments": { "target": "render_profile" } }
{ "tool": "start_render_profile" }
```

동일한 스크롤 동작을 반복한 후 결과를 확인합니다:

```json
{ "tool": "get_render_report" }
```

최적화된 컴포넌트의 `unnecessaryRenders` 항목이 비어 있거나 크게 줄어들어야 합니다.

## Step 6: 정리

```json
{ "tool": "clear", "arguments": { "target": "render_profile" } }
```

## 요약

| 단계 | 도구                                                      | 목적                        |
| ---- | --------------------------------------------------------- | --------------------------- |
| 1    | `start_render_profile`                                    | 렌더 추적 시작              |
| 2    | `swipe`                                                   | 문제 상황 재현              |
| 3    | `get_render_report`                                       | 렌더 패턴 분석              |
| 4    | —                                                         | `React.memo` 적용 대상 식별 |
| 5    | `clear` (target: render_profile) + `start_render_profile` | 최적화 후 재프로파일링      |
| 6    | `clear` (target: render_profile)                          | 정리                        |
