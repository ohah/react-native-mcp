# 비주얼 리그레션 테스트

비주얼 베이스라인을 생성하고, UI 변경을 감지하며, 요소 단위 스크린샷을 비교하는 단계별 워크플로우입니다.

## 시나리오

리팩토링이 화면의 외관을 의도치 않게 변경하지 않았는지 확인하려고 합니다.

## 1단계: 베이스라인 생성

각 화면의 현재 상태를 베이스라인 이미지로 저장합니다.

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "updateBaseline": true
  }
}
```

다른 화면으로 이동한 뒤 해당 화면의 베이스라인을 생성합니다:

```json
{
  "tool": "open_deeplink",
  "arguments": { "platform": "ios", "url": "myapp://profile" }
}

{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/profile.png",
    "updateBaseline": true
  }
}
```

## 2단계: 요소 단위 베이스라인 생성

더 집중적인 테스트를 위해 셀렉터를 사용하여 특정 컴포넌트의 베이스라인을 생성합니다.

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/header.png",
    "selector": "#header",
    "updateBaseline": true
  }
}
```

## 3단계: 코드 변경 적용

리팩토링 또는 코드 변경을 적용한 후 앱을 다시 빌드하고 리로드합니다.

## 4단계: 베이스라인과 비교

저장된 베이스라인과 비교를 실행합니다.

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "saveDiff": "/tmp/diffs/home-diff.png",
    "saveCurrent": "/tmp/diffs/home-current.png"
  }
}
```

**응답 예시 (변경 없음):**

```json
{
  "pass": true,
  "diffRatio": 0.001,
  "diffPixels": 209,
  "totalPixels": 209664,
  "threshold": 0.1,
  "message": "Visual comparison passed: 0.1% of pixels differ"
}
```

**응답 예시 (변경 감지):**

```json
{
  "pass": false,
  "diffRatio": 0.087,
  "diffPixels": 18240,
  "totalPixels": 209664,
  "threshold": 0.1,
  "message": "Visual difference detected: 8.7% of pixels differ"
}
```

## 5단계: diff 확인

비교가 실패하면 저장된 diff 이미지를 확인하여 정확히 무엇이 변경되었는지 살펴봅니다. diff 이미지는 변경된 픽셀을 빨간색으로 강조 표시합니다.

```json
{
  "tool": "take_screenshot",
  "arguments": { "platform": "ios", "filePath": "/tmp/diffs/home-current.png" }
}
```

## 6단계: 필요 시 임계값 조정

사소한 렌더링 차이(안티앨리어싱, 폰트 렌더링)로 인해 잘못된 실패가 발생하면 임계값을 높입니다:

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "threshold": 0.2
  }
}
```

픽셀 단위의 정밀한 비교를 위해서는 임계값을 낮춥니다:

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "threshold": 0.01
  }
}
```

## 7단계: 의도적 변경 후 베이스라인 업데이트

비주얼 변경이 의도된 것이라면 베이스라인을 업데이트합니다:

```json
{
  "tool": "visual_compare",
  "arguments": {
    "platform": "ios",
    "baseline": "/tmp/baselines/home.png",
    "updateBaseline": true
  }
}
```

## 요약

| 단계 | 도구                                         | 목적                      |
| ---- | -------------------------------------------- | ------------------------- |
| 1    | `visual_compare` (updateBaseline)            | 전체 화면 베이스라인 생성 |
| 2    | `visual_compare` (selector + updateBaseline) | 요소 단위 베이스라인 생성 |
| 3    | —                                            | 코드 변경 적용            |
| 4    | `visual_compare` (saveDiff)                  | 비교 및 diff 생성         |
| 5    | `take_screenshot`                            | 현재 상태 확인            |
| 6    | `visual_compare` (threshold)                 | 민감도 조정               |
| 7    | `visual_compare` (updateBaseline)            | 의도적 변경 반영          |
