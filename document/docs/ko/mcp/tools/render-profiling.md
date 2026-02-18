# Render Profiling

React 컴포넌트 렌더링을 프로파일링하는 도구입니다. 핫 컴포넌트, 불필요한 리렌더, 최적화 기회를 식별할 수 있습니다.

## start_render_profile

렌더 프로파일링을 시작합니다. 컴포넌트의 마운트, 리렌더, 부모 리렌더로 인한 불필요한 렌더를 추적합니다.

#### Parameters

| Parameter    | Type                 | Required | Description                                                                                          |
| ------------ | -------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `components` | `string[]`           | No       | 화이트리스트: 이 컴포넌트들만 추적합니다. `ignore`보다 우선 적용됩니다                               |
| `ignore`     | `string[]`           | No       | 블랙리스트: 이 컴포넌트들을 건너뜁니다 (기본 무시 목록에 추가됨). `components`가 설정되면 무시됩니다 |
| `platform`   | `"ios" \| "android"` | No       | 대상 플랫폼                                                                                          |
| `deviceId`   | `string`             | No       | 대상 디바이스                                                                                        |

#### Example

```json
// 모든 컴포넌트를 프로파일링
{ "tool": "start_render_profile" }

// 특정 컴포넌트만 프로파일링
{
  "tool": "start_render_profile",
  "arguments": { "components": ["ProductList", "CartScreen", "Header"] }
}

// 노이즈가 많은 컴포넌트 무시
{
  "tool": "start_render_profile",
  "arguments": { "ignore": ["AnimatedView", "SafeAreaView"] }
}
```

#### Tips

- `components`를 사용하여 특정 화면이나 기능에 집중할 수 있습니다.
- `ignore`를 사용하여 노이즈를 발생시키는 프레임워크 컴포넌트를 필터링할 수 있습니다.
- 프로파일링 시작 → 사용자 액션 수행 → `get_render_report` 호출 순서로 결과를 확인합니다.

---

## get_render_report

렌더 프로파일링 리포트를 가져옵니다. 핫 컴포넌트, 불필요한 렌더, 트리거 분석이 포함된 최근 렌더 상세 정보를 보여줍니다.

#### Parameters

| Parameter  | Type                 | Required | Description   |
| ---------- | -------------------- | -------- | ------------- |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼   |
| `deviceId` | `string`             | No       | 대상 디바이스 |

#### Example

```json
// Request
{ "tool": "get_render_report" }

// Response
{
  "hotComponents": [
    { "component": "ProductCard", "renderCount": 24, "mountCount": 6 },
    { "component": "PriceLabel", "renderCount": 18, "mountCount": 6 }
  ],
  "unnecessaryRenders": [
    {
      "component": "Header",
      "count": 12,
      "message": "Header re-rendered 12 times without prop changes — wrap with React.memo"
    }
  ],
  "recentRenders": [
    {
      "component": "ProductCard",
      "timestamp": 1700000001234,
      "trigger": "parent",
      "changedProps": []
    }
  ]
}
```

#### Tips

- `hotComponents`는 렌더 횟수 기준으로 정렬됩니다 — 상위 항목이 최적화 대상입니다.
- `unnecessaryRenders`는 props 변경 없이 리렌더된 컴포넌트를 식별합니다 — `React.memo`로 감싸면 이를 방지할 수 있습니다.
- `trigger: "parent"`는 해당 컴포넌트가 자체 props 변경이 아닌 부모 리렌더로 인해 리렌더되었음을 의미합니다.

---

## clear_render_profile

렌더 프로파일링을 중지하고 수집된 모든 데이터를 삭제합니다.

#### Parameters

| Parameter  | Type                 | Required | Description   |
| ---------- | -------------------- | -------- | ------------- |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼   |
| `deviceId` | `string`             | No       | 대상 디바이스 |

#### Example

```json
{ "tool": "clear_render_profile" }
```

#### Tips

- 프로파일링이 끝나면 호출하여 오버헤드를 중지하세요.
- 삭제 후에는 데이터를 복구할 수 없습니다 — 먼저 `get_render_report` 결과를 저장해 두세요.
