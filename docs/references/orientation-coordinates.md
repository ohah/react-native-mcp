# iOS 시뮬레이터 orientation과 idb 좌표계

## 개요

idb(`ui tap`, `ui swipe`)는 **항상 GraphicsOrientation=1 (portrait 0°) 기준 좌표**를 기대한다.
React Native의 `measure`/`querySelector`는 **현재 orientation 기준 좌표**를 반환하므로, portrait이 아닌 경우 좌표 변환이 필요하다.

## GraphicsOrientation 값

| 값  | 설명          | 변환 공식 (RN → idb) |
| --- | ------------- | -------------------- |
| 1   | Portrait 0°   | `(x, y)` — 변환 없음 |
| 2   | Portrait 180° | `(W - x, H - y)`     |
| 3   | Landscape A   | `(y, W - x)`         |
| 4   | Landscape B   | `(H - y, x)`         |

- **W** = 현재 orientation의 `window.width` (RN `Dimensions.get('window').width`)
- **H** = 현재 orientation의 `window.height`

## GraphicsOrientation 읽기

```bash
xcrun simctl spawn <UDID> defaults read com.apple.backboardd
# 출력 예시: GraphicsOrientation = 3;
```

**주의**: plist 파일(`~/Library/Developer/CoreSimulator/Devices/<UDID>/data/Library/Preferences/com.apple.backboardd.plist`)은 실시간으로 갱신되지 않음. 반드시 `xcrun simctl spawn ... defaults read` 사용.

## RN에서 orientation 구분

- RN 표준 API (`Dimensions`)로는 `portrait` vs `landscape` (width > height)만 구분 가능.
- **90° vs 270°, 0° vs 180° 구분 불가** — RN만으로는 4방향 구분이 안 됨.
- 따라서 `xcrun simctl spawn`으로 시뮬레이터 자체에서 GraphicsOrientation을 읽는 방식을 사용.

## 구현

### 자동 감지 (기본)

`ios-landscape.ts`의 `getIOSOrientationInfo()`:

1. RN 런타임에서 `getScreenInfo()` → `window.width`, `window.height` 수집
2. `xcrun simctl spawn <udid> defaults read com.apple.backboardd` → GraphicsOrientation 수집
3. `transformForIdb(x, y, info)` → 변환된 portrait 좌표 반환

### 수동 override

MCP 도구의 `iosOrientation` 파라미터 또는 e2e.yaml `config.orientation`으로 강제 지정:

```yaml
config:
  platform: ios
  orientation: 3 # GraphicsOrientation 값 (1-4)
```

지정 시 xcrun 자동감지를 건너뛰고 해당 값으로 변환. **용도:**

- 실기기 (xcrun 사용 불가)
- CI에서 orientation이 고정된 경우
- 자동감지가 실패하는 환경

## Android

Android (`adb shell input tap/swipe`)는 **현재 orientation 기준 좌표를 받으므로 변환이 필요 없다.** dp → pixel 변환(`x * scale`)만 적용.

## 적용 범위

orientation 변환이 적용되는 MCP 도구:

- `tap` — `transformForIdb(x, y)`
- `swipe` — start/end 좌표 모두 변환
- `scroll_until_visible` — 내부 swipe 좌표 변환
