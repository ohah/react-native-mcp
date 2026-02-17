# iOS 시뮬레이터 landscape 좌표 변환 — 분석 및 해결

## 결론 (해결됨)

iOS 시뮬레이터에서 **4가지 orientation 모두 지원**.

| GraphicsOrientation | 각도          | 변환 공식 (RN → idb) | 상태         |
| ------------------- | ------------- | -------------------- | ------------ |
| 1                   | Portrait 0°   | `(x, y)`             | ✅ 실측 확인 |
| 2                   | Portrait 180° | `(W - x, H - y)`     | ✅ 실측 확인 |
| 3                   | Landscape A   | `(y, W - x)`         | ✅ 실측 확인 |
| 4                   | Landscape B   | `(H - y, x)`         | ✅ 실측 확인 |

- **W** = 현재 orientation의 window width (`getScreenInfo().window.width`)
- **H** = 현재 orientation의 window height (`getScreenInfo().window.height`)
- Android는 orientation 보정 없이 `(x, y) → px` 변환만으로 정상 동작.

---

## 1. 원래 문제

iPad landscape (90°)에서 E2E 테스트 시 "Count" 버튼은 눌리는데 "다음" 버튼이 안 눌리는 현상.

- **원인**: 기존 코드가 landscape일 때 `(y, x)` swap을 적용했는데, 이 공식이 **틀렸음**.
- **Count 버튼이 된 이유**: 화면 가로 중앙(`x = W/2 = 590`)에 있어서 `W - x = x`가 되어 우연히 동작.
- **다음 버튼이 안 된 이유**: `x = 1128`이라 `W - x = 52 ≠ 1128`. swap으로 `(793, 1128)`을 보냈는데 정답은 `(793, 52)`.

## 2. 핵심 발견: idb는 항상 portrait 좌표 기대

`idb ui tap/swipe`는 **GraphicsOrientation=1 (portrait 0°) 기준 좌표**를 항상 기대한다. 현재 display orientation과 무관하게 portrait 좌표계로 변환해서 보내야 한다.

### GraphicsOrientation 감지 방법

```bash
xcrun simctl spawn <UDID> defaults read com.apple.backboardd
# → GraphicsOrientation = 3 (예시)
```

- `com.apple.backboardd`의 `GraphicsOrientation` 값을 실시간으로 읽음
- plist 파일(`~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Library/Preferences/com.apple.backboardd.plist`)은 **실시간 반영 안 됨**. 반드시 `xcrun simctl spawn ... defaults read` 사용.

### 검증 과정

각 orientation에서 `idb ui describe-point`로 후보 좌표를 넣어 버튼이 반환되는 좌표를 찾고, `idb ui tap`으로 Count 증가를 확인.

## 3. 구현

### 파일

- `packages/react-native-mcp-server/src/tools/ios-landscape.ts` — `getIOSOrientationInfo()` + `transformForIdb()`
- `tap.ts`, `swipe.ts`, `scroll-until-visible.ts` — 모두 orientation 변환 적용

### 자동 감지 + 수동 override

1. **자동 감지** (기본): `xcrun simctl spawn` → GraphicsOrientation 읽기 → 변환 공식 적용
2. **수동 override**: e2e.yaml `config.orientation` 또는 MCP tool의 `iosOrientation` 파라미터로 강제 지정 가능. xcrun 감지를 건너뜀.

```yaml
config:
  platform: ios
  orientation: 3 # LandscapeA 강제
```

### 실기기 한계

- `xcrun simctl spawn`은 **시뮬레이터 전용**. 실기기에서는 실패 → 기본값 1 (portrait) 사용.
- 실기기 landscape 지원이 필요하면 `config.orientation`으로 수동 지정하거나, RN 네이티브 모듈(`UIDevice.current.orientation`)을 추가해야 함.

---

## 4. 이전 분석 (폐기됨)

이전 분석에서는 90°를 `(y, x)`, 270°를 `(H-y, x)`로 기록했으나, 이는 **GraphicsOrientation 값과의 매핑이 잘못된 것**이었다. 실제로는:

- GraphicsOrientation=3: `(y, W-x)` (이전에 90°로 착각했으나 실제 공식이 다름)
- GraphicsOrientation=4: `(H-y, x)`

Count 버튼이 `x = W/2`에 있어서 `(y, x)` = `(y, W-x)`가 우연히 성립해 기존 코드가 동작하는 것처럼 보였다.
