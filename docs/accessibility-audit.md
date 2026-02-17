# accessibility_audit

React Native 앱의 Fiber 컴포넌트 트리를 순회해 **접근성(a11y) 규칙 위반**을 자동으로 검출하는 MCP 도구입니다. 웹의 axe-core·Lighthouse에 해당하는 역할을 모바일 RN 앱에서 수행합니다.

## 사용법

### 도구 호출

```
accessibility_audit({ maxDepth?, deviceId?, platform? })
```

| 인자       | 타입   | 설명                                                                |
| ---------- | ------ | ------------------------------------------------------------------- |
| `maxDepth` | number | 감사할 트리 깊이 상한. 기본 999. 큰 앱에서는 30~50으로 줄이면 유리. |
| `deviceId` | string | 대상 디바이스 ID (선택). `get_debugger_status`로 확인.              |
| `platform` | string | `"ios"` \| `"android"` (선택). 한 플랫폼만 연결 시 생략 가능.       |

### 반환 형식

도구는 **위반 목록**을 JSON 배열로 반환합니다.

```json
[
  {
    "rule": "pressable-needs-label",
    "selector": "#submit-btn",
    "severity": "error",
    "message": "Pressable에 onPress/onLongPress가 있으나 accessibilityLabel 또는 접근 가능한 텍스트가 없습니다."
  },
  {
    "rule": "touch-target-size",
    "selector": "#small-btn",
    "severity": "warning",
    "message": "터치 영역이 44x44pt 미만입니다 (32x28pt)"
  }
]
```

- **rule**: 위반 규칙 식별자
- **selector**: 요소를 가리키는 선택자. testID가 있으면 `#testID`, 없으면 `TypeName@경로` (예: `Pressable@0.1.2`)
- **severity**: `error` \| `warning`
- **message**: 한글 설명

## 검사 규칙

| 규칙                  | 설명                                                                               | severity |
| --------------------- | ---------------------------------------------------------------------------------- | -------- |
| pressable-needs-label | onPress/onLongPress가 있는데 accessibilityLabel 또는 자식 텍스트·Image 라벨이 없음 | error    |
| image-needs-alt       | Image 컴포넌트에 accessibilityLabel 없음                                           | error    |
| touch-target-size     | 터치 영역이 44×44pt 미만 (measure로 계산)                                          | warning  |
| missing-role          | 인터랙티브 요소(onPress/onLongPress)에 accessibilityRole 없음                      | warning  |

**text-contrast** (텍스트/배경 색상 대비)는 미구현입니다. RN에서 색상이 processColor로 숫자화되어 Fiber만으로 대비비 계산이 어렵기 때문입니다. 런타임·도구 주석에 사유가 명시되어 있습니다.

## 구현 요약

- **서버**: MCP 도구 `accessibility_audit`가 앱에 `getAccessibilityAudit({ maxDepth })`를 eval로 보내고, 반환된 위반 배열을 그대로 JSON으로 전달합니다.
- **런타임** (`runtime.js`): `getAccessibilityAudit(options)`가 Fiber 트리를 두 번 순회합니다.
  1. 첫 순회: pressable-needs-label, image-needs-alt, missing-role 검사 (props 기반).
  2. onPress/onLongPress가 있는 노드에 대해 `measureViewSync(uid)`로 크기 조회 후, 44×44pt 미만이면 touch-target-size 위반으로 추가합니다.
- **selector**: testID가 있으면 `#testID`, 없으면 `getPathUid(fiber)`로 얻은 경로를 사용해 `TypeName@경로` 형태로 출력합니다.

## 사용 예시

- AI/에이전트: "앱 접근성 감사해줘" → `accessibility_audit()` 호출 후 위반 목록을 사용자에게 요약하거나, 수정 포인트로 활용.
- CI: E2E 또는 별도 스크립트에서 `accessibility_audit` 호출 후 `error` 위반이 있으면 실패로 처리하도록 연동 가능.

## 참고

- `take_snapshot`, `query_selector`로 트리·요소를 탐색하는 것과 달리, 이 도구는 **위반만** 반환합니다. 위반이 없으면 빈 배열 `[]`입니다.
- 규칙 추가·심각도 조정은 `runtime.js`의 `getAccessibilityAudit`와 서버 도구 설명을 함께 수정하면 됩니다.
