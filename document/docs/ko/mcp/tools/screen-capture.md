# Screen Capture

스크린샷 캡처, 컴포넌트 트리 스냅샷, 네이티브 UI 트리 조회, 시각적 회귀 테스트를 위한 도구입니다.

## take_screenshot

디바이스/시뮬레이터 화면을 JPEG 이미지(720p)로 캡처합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                 |
| ---------- | -------------------- | -------- | ----------------------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | `android`: adb 사용. `ios`: simctl 사용 (시뮬레이터만 지원) |
| `filePath` | `string`             | No       | 스크린샷 파일을 저장할 경로                                 |

#### Example

```json
// Request
{ "tool": "take_screenshot", "arguments": { "platform": "ios" } }
```

#### Tips

- base64 JPEG와 좌표 변환을 위한 포인트 크기 메타데이터를 반환합니다.
- 가능하면 스크린샷보다 `assert_text` 또는 `assert_visible`을 사용하세요 — 스크린샷은 비전 토큰을 소모합니다.
- iOS는 시뮬레이터만 지원하며, 실제 디바이스는 지원하지 않습니다.

---

## take_snapshot

React Native 컴포넌트 트리를 캡처합니다. UID, 타입, testID, 텍스트 내용을 반환합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                        |
| ---------- | -------------------- | -------- | ---------------------------------- |
| `platform` | `"ios" \| "android"` | No       | 대상 플랫폼                        |
| `deviceId` | `string`             | No       | 대상 디바이스                      |
| `maxDepth` | `number`             | No       | 최대 트리 깊이 (1–100). 기본값: 30 |

#### Example

```json
// Request
{ "tool": "take_snapshot", "arguments": { "maxDepth": 10 } }

// Response (abbreviated)
{
  "tree": {
    "uid": "RCTView:0",
    "type": "View",
    "children": [
      {
        "uid": "header",
        "type": "View",
        "testID": "header",
        "children": [
          { "uid": "header>Text:0", "type": "Text", "text": "Home" }
        ]
      }
    ]
  }
}
```

#### Tips

- `uid` 값을 `evaluate_script`의 `measureView(uid)`와 함께 사용하면 정확한 좌표를 얻을 수 있습니다.
- 큰 컴포넌트 트리에서는 `maxDepth`를 줄여 출력 크기를 제한하세요.
- 스냅샷은 네이티브 뷰 계층이 아닌 React Fiber 트리를 순회합니다.

---

## describe_ui

네이티브 UI/접근성 트리를 조회합니다. 전체 네이티브 계층 구조를 반환합니다.

#### Parameters

| Parameter  | Type                 | Required | Description                                                                                          |
| ---------- | -------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| `platform` | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                                                                          |
| `mode`     | `"all" \| "point"`   | No       | iOS: `all`은 전체 트리를 덤프하고, `point`는 (x,y) 위치를 조회합니다. Android: 무시됨. 기본값: `all` |
| `x`        | `number`             | No       | X 좌표(포인트 단위). iOS `mode=point`에서 필수                                                       |
| `y`        | `number`             | No       | Y 좌표(포인트 단위). iOS `mode=point`에서 필수                                                       |
| `nested`   | `boolean`            | No       | iOS: 계층적 트리 반환. Android: 무시됨. 기본값: `false`                                              |
| `deviceId` | `string`             | No       | 디바이스 ID                                                                                          |

#### Example

```json
// Request — iOS point query
{
  "tool": "describe_ui",
  "arguments": { "platform": "ios", "mode": "point", "x": 200, "y": 400 }
}
```

#### Tips

- 큰 페이로드를 생성합니다. React Native 요소를 조회할 때는 `query_selector`를 사용하는 것이 좋습니다.
- iOS는 `idb ui describe-all/describe-point`를, Android는 `uiautomator dump`를 사용합니다.
- React 트리에 포함되지 않는 네이티브 컴포넌트(예: 네이티브 알림, 시스템 UI)를 검사할 때 유용합니다.

---

## visual_compare

시각적 회귀 테스트를 위해 현재 화면을 베이스라인 PNG와 비교합니다.

#### Parameters

| Parameter        | Type                 | Required | Description                                                     |
| ---------------- | -------------------- | -------- | --------------------------------------------------------------- |
| `platform`       | `"ios" \| "android"` | **Yes**  | 대상 플랫폼                                                     |
| `baseline`       | `string`             | **Yes**  | 베이스라인 PNG 파일의 절대 경로                                 |
| `selector`       | `string`             | No       | 특정 요소를 크롭하기 위한 셀렉터. 생략 시 전체 화면 비교        |
| `threshold`      | `number`             | No       | pixelmatch 임계값 (0–1). 기본값: `0.1`                          |
| `updateBaseline` | `boolean`            | No       | `true`이면 현재 스크린샷을 새 베이스라인으로 저장 (비교 건너뜀) |
| `saveDiff`       | `string`             | No       | 차이 이미지 PNG를 저장할 경로                                   |
| `saveCurrent`    | `string`             | No       | 현재 스크린샷 PNG를 저장할 경로                                 |
| `deviceId`       | `string`             | No       | 디바이스 ID                                                     |

#### Example

```json
// Create baseline
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "updateBaseline": true
  }
}

// Compare against baseline
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "saveDiff": "/tmp/diffs/home-diff.png",
    "threshold": 0.05
  }
}

// Response
{
  "pass": false,
  "diffRatio": 0.023,
  "diffPixels": 4821,
  "totalPixels": 209664,
  "threshold": 0.05,
  "message": "Visual difference detected: 2.3% of pixels differ"
}
```

#### Tips

- 초기 베이스라인을 생성하려면 `updateBaseline: true`를 사용하세요.
- 전체 화면 대신 특정 컴포넌트(예: `#header`)만 비교하려면 `selector`를 사용하세요.
- `threshold` 값이 낮을수록 더 엄격합니다 (0 = 픽셀 단위 완벽 일치, 1 = 모든 차이 통과).
- 내부적으로 [sharp](https://sharp.pixelplumbing.com/) + [pixelmatch](https://github.com/mapbox/pixelmatch)를 사용합니다.
