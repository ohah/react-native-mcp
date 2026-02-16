# 보정에 필요한 것: React Native에서 알 수 있는지, idb 좌표

## 1. React Native에서 orientation을 얼마나 구분할 수 있는가

### 지금 우리가 쓰는 것 (표준 API)

- **`Dimensions.get('window')`** → `width`, `height` 만 있음.
- **구분 가능한 것**: **세로 vs 가로** 한 가지만 가능.
  - `width > height` → `'landscape'`
  - `width <= height` → `'portrait'`
- **구분 불가능한 것**:
  - **90°(가로 오른쪽)** vs **270°(가로 왼쪽)** → 둘 다 `landscape` (width > height)라서 RN만으로는 구분 불가.
  - **0°(세로)** vs **180°(세로 거꾸로)** → 둘 다 `portrait` (width < height)라서 구분 불가.

그래서 **지금 구조에서는 “세로 / 가로” 두 가지만 알 수 있고, 90/180/240/270 같은 각도는 RN 표준 API만으로는 알 수 없음.**

### 270°(Landscape Left)를 알 방법이 있나요?

**RN 표준 API만으로는 불가**합니다. `Dimensions`는 width/height만 주므로 90°와 270°를 구분할 수 없습니다.

**가능한 방법** (앱 또는 MCP 클라이언트 쪽에 뭔가 넣을 때만):

1. **iOS 네이티브 API**
   - `[[UIApplication sharedApplication] statusBarOrientation]` 이 **UIInterfaceOrientationLandscapeLeft(4)** / **UIInterfaceOrientationLandscapeRight(3)** 를 구분해서 줍니다.
   - 이걸 JS로 넘기려면 **커스텀 네이티브 모듈**을 하나 만들어서 (예: `getInterfaceOrientation()` → `'landscape-left'` | `'landscape-right'` | `'portrait'` 등) 앱 또는 MCP 클라이언트 패키지에 포함하면 됩니다. RN 공식 [Native Modules iOS](https://reactnative.dev/docs/native-modules-ios) 문서대로 구현하면 됨.
2. **외부 라이브러리**
   - **react-native-orientation-manager**, **react-native-orientation-locker** 등이 `LANDSCAPE-LEFT` / `LANDSCAPE-RIGHT` (또는 `landscape-left` / `landscape-right`)를 이벤트/훅으로 줍니다.
   - 앱에 의존성 추가 + iOS/Android 네이티브 설정이 필요합니다.

둘 다 **앱(또는 MCP가 주입되는 클라이언트)에 네이티브 코드/의존성 추가**가 필요합니다. 데모 앱 규칙상 앱 수정을 하지 않기로 했으면, 현재 구조에서는 270°를 구분할 수 없고, landscape일 때 90°만 가정한 (y, x) 보정만 쓰게 됩니다.

**정리**:

- **지금**: RN 표준만으로는 **portrait / landscape 두 가지만** 알 수 있음.
- **270°를 쓰려면**: iOS 네이티브 모듈로 `statusBarOrientation` 노출하거나, orientation 전용 라이브러리를 쓰면 됨. (앱/클라이언트 수정 필요.)

---

## 2. 보정하는 데 실제로 뭐가 필요한지

보정이란:  
**앱이 주는 (x, y)** → **idb에 넘겨야 할 (ix, iy)** 로 바꾸는 것.

- **0° (세로)**: 실측으로 **(x, y) 그대로** 넘기면 됨. 추가 보정 없음.
- **90° (가로 오른쪽)**: 실측으로 **(y, x)** 로 스왑해서 넘기면 됨. 지금 코드에 반영됨.
- **180° (세로 거꾸로)**: 아직 실측 안 함.
  - 이론상으로는 “세로”이므로 (x,y) 그대로일 수도 있고,
  - idb가 “항상 0° 기준”이면 (W−x, H−y) 같은 변환이 필요할 수 있음.
  - **필요한 것**: 180°로 고정한 뒤, idb에 (x,y), (W−x, y), (x, H−y), (W−x, H−y) 등 몇 가지 후보를 넣어보고, 어떤 (ix, iy)에서 탭이 버튼에 잡히는지 **실측**.
- **270° (가로 왼쪽)**: 실측 완료.
  - **idb describe-point**에 (ix, iy) 후보를 넣어본 결과, 앱 버튼 중앙 (x, y) = (590, 155)일 때  
    **idb에서는 (H−y, x) = (820−155, 590) = (665, 590)** 일 때 버튼이 반환됨.
  - **idb ui tap (665, 590)** 으로 Count 2 → 3 증가 확인.
  - **결론: 270°에서 idb 좌표 = (H−y, x)**. (90°에서 쓰는 (y, x)와 다름.)

그래서 **보정에 필요한 것**은:

1. **앱에서**:
   - 지금처럼 **window 기준 (x, y)** (measure 중앙 등)
   - - 가능하면 **window 크기 (W, H)** (이미 getScreenInfo로 얻음)
   - - **가능하다면** “90 / 180 / 270” 구분 (위에서 말한 대로 RN만으로는 어렵고, 추가 수단 필요).
2. **idb 쪽**:
   - **문서에는 “tap 좌표계”가 명시돼 있지 않음.**
   - 실측 결과만 있음:
     - 0°: (x,y)
     - 90°: (y,x)
     - 180°: 미실측
     - 270°: **(H−y, x)** (describe-point 및 tap으로 확인).

---

## 3. idb에서 “실제 좌표”를 어떻게 찾을 수 있는지

- **문서**: idb 공식 문서에는 “tap이 어떤 좌표계(0° 기준인지, 현재 화면 기준인지, points인지 pixels인지)”가 **명시돼 있지 않음**.
- **구현 위치**:
  - idb는 **Companion(Objective-C++)** 이 **FBSimulatorControl** 같은 걸로 시뮬레이터에 입력을 보냄.
  - “실제 좌표”가 어떻게 쓰이는지는 **idb/Companion 또는 FBSimulatorControl 소스**에서 tap/HID/event 관련 코드를 찾아봐야 함.
  - 웹 검색만으로는 “이 각도일 때 이렇게 변환한다” 같은 공식은 나오지 않음.
- **실제로 할 수 있는 것**:
  1. **describe-all**
     - 시뮬레이터를 90°로 두고 `idb ui describe-all` 하면, 앱 measure와 **같은** (x,y) 프레임이 나옴.
     - 즉 “앱 좌표계”와 “describe-all 좌표계”는 그때는 일치.
  2. **describe-point**
     - 90°에서 (590, 155)를 넣으면 **빈 요소**가 나옴.
     - (155, 590)을 넣으면? (이건 우리가 tap으로만 검증했지 describe-point로는 안 해봤을 수 있음.)
     - **실제 좌표 찾는 방법**:
       - 해당 각도로 고정한 뒤,
       - `idb ui describe-point <ix> <iy>` 에 (ix, iy) 후보를 여러 개 넣어보고,
       - **버튼 요소(press-counter-button 등)가 반환되는 (ix, iy)** 를 찾으면, 그게 “idb가 그 각도에서 기대하는 좌표”임.
  3. **tap**
     - `idb ui tap <ix> <iy>` 로 (ix, iy)를 넣어보고,
     - **앱에서 Count가 올라가는 (ix, iy)** 를 찾으면, 그게 “실제로 탭이 들어가는 좌표”임.
     - 우리가 90°에서 (155, 590)이 동작한다고 실측한 것이 이 방법.

그래서 **idb “실제 좌표”를 찾는 방법**은:

- **코드/문서로는 좌표계가 안 나와 있음.**
- **실측**으로만 확인 가능:
  - **describe-point**: 여러 (ix, iy) 넣어서 “버튼이 나오는 좌표” 찾기.
  - **tap**: 여러 (ix, iy) 넣어서 “Count가 올라가는 좌표” 찾기.
- 180°, 270°(또는 240°)에 대해서도, 위와 같은 식으로 **후보 (ix, iy)를 몇 개 넣어보는 실험**이 필요함.

---

## 4. 요약 (설명만, 작업 X)

| 질문                                 | 답                                                                                                                                                                                |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **RN에서 90/180/240/360 구분 가능?** | **표준 API만으로는 불가.** `Dimensions`로는 portrait/landscape 두 가지만 구분 가능. 4가지 각도를 쓰려면 추가 API/라이브러리 필요.                                                 |
| **보정하는 데 뭐가 필요해?**         | (1) 앱 (x,y) + 창 크기 (W,H) (이미 있음), (2) **각도별로 “idb에 넣었을 때 탭이 잡히는 (ix, iy)”를 실측**해서 공식 결정. 90° (y,x), 270° (H−y, x) 실측 완료. 180°는 미실측.        |
| **idb 실제 좌표는 어떻게 찾아?**     | 문서에는 좌표계가 없음. **describe-point**에 (ix, iy) 여러 개 넣어서 “버튼이 나오는 좌표” 찾기, **tap**에 (ix, iy) 넣어서 “Count 오르는 좌표” 찾기 같은 **실험**으로만 확인 가능. |
| **현재 tap 동작 여부 (iOS)**         | **0°·90°만 지원** (현재 코드 유지). 180°·270°는 지원하지 않음.                                                                                                                    |
| **Android(adb)도 그런가?**           | **실측: 세로 등에서 tap 정상 동작 확인.** orientation 보정 없이 (x,y)→px만 전달. 90°·180°·270°만 따로 검증한 실험은 미실측.                                                       |

작업은 하지 말고, 위 내용만 설명해 주시면 됐음.
