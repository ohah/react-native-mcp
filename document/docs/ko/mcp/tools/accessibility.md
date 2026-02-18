# Accessibility

React Native 앱을 위한 자동화된 접근성 감사 도구입니다.

## accessibility_audit

React Native 컴포넌트 트리에 대해 접근성 감사를 실행합니다. 심각도, 규칙 이름, 조치 가능한 메시지와 함께 위반 사항을 반환합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                  |
| ---------- | -------------------- | -------- | -------------------------------------------- |
| `maxDepth` | `number`             | No       | 감사할 최대 트리 깊이 (1–100). 기본값: `999` |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                                  |
| `deviceId` | `string`             | No       | 대상 디바이스                                |

#### Rules

| Rule                    | Severity | Description                                                             |
| ----------------------- | -------- | ----------------------------------------------------------------------- |
| `pressable-needs-label` | error    | Pressable 요소에는 접근성 레이블이 있어야 합니다                        |
| `image-needs-alt`       | error    | 이미지에는 대체 텍스트(`accessibilityLabel` 또는 `alt`)가 있어야 합니다 |
| `touch-target-size`     | warning  | 터치 대상은 최소 44×44 포인트여야 합니다                                |
| `missing-role`          | warning  | 인터랙티브 요소에는 `accessibilityRole`이 있어야 합니다                 |

#### Example

```json
// Run audit
{ "tool": "accessibility_audit" }

// Response
{
  "violations": [
    {
      "rule": "pressable-needs-label",
      "severity": "error",
      "selector": "#close-btn",
      "message": "Pressable at #close-btn has no accessibilityLabel"
    },
    {
      "rule": "touch-target-size",
      "severity": "warning",
      "selector": "#small-link",
      "message": "Touch target at #small-link is 32×28 points (minimum: 44×44)"
    },
    {
      "rule": "image-needs-alt",
      "severity": "error",
      "selector": "Image:nth-of-type(3)",
      "message": "Image has no accessibilityLabel or alt prop"
    }
  ],
  "summary": {
    "errors": 2,
    "warnings": 1,
    "passes": 45
  }
}
```

#### Tips

- 개발 중 모든 화면에서 이 감사를 실행하여 접근성 문제를 조기에 발견하세요.
- 이 감사는 React Fiber 트리를 순회하므로 네이티브 뷰가 아닌 React Native 컴포넌트를 검사합니다.
- `error` 심각도 문제를 먼저 수정하세요 (스크린 리더 사용자는 레이블이 없는 컨트롤을 사용할 수 없습니다).
- 위반 사항을 수정한 후 감사를 다시 실행하여 해결되었는지 확인하세요.
