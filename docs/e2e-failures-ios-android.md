# E2E 실패 정리 (iOS / Android) 및 수정 방향

> CI(GitHub Actions) 또는 로컬에서 `전체 35 스텝` YAML 실행 시 발생하는 플랫폼별 실패 요약.
> **규칙:** 데모 앱 소스는 수정하지 않음. YAML·타이밍·옵션만 조정.

---

## 1. 실패 지점 요약

| 플랫폼      | 실패 스텝 / 메시지                                                         | 추정 원인                                                       |
| ----------- | -------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **iOS**     | `waitForVisible TouchableOpacity (0)` 직후 (다음 `tap` 단계에서 중단 가능) | 탭 직전 레이아웃 미안정 또는 measure/clamp 이슈                 |
| **Android** | `waitForText "버튼 15 (1)"` 타임아웃 (6.5s)                                | 스크롤 직후 탭이 실제 버튼에 닿지 않음 (스크롤/레이아웃 지연)   |
| **Android** | `waitForText "상태: 열림"` 타임아웃 (5.9s), selector `#sheet-status`       | Bottom sheet 스와이프가 시트를 열기에 부족 (거리/속도/지속시간) |

---

## 2. 원인 분석

### 2.1 Android — "버튼 15 (1)" not found

- **흐름:** `swipe` → `wait 1500` → `scrollUntilVisible "버튼 15 (0)"` → `tap "버튼 15 (0)"` → `waitForText "버튼 15 (1)"`.
- **가능 원인:**
  - `scroll_until_visible` 성공 후 **즉시** `tap`을 호출하면, Android에서 리스트/스크롤 뷰가 아직 레이아웃을 끝내지 않아 measure 좌표가 어긋나거나 탭이 다른 곳에 들어갈 수 있음.
  - `scroll_until_visible` 내부의 swipe 후 500ms 대기만으로는 기기/에뮬레이터에 따라 부족할 수 있음.
- **수정 방향:** `scrollUntilVisible` 직후 **짧은 대기**(예: 300~500ms)를 넣어 레이아웃 안정화 후 `tap` 실행. 필요 시 해당 스텝만 `waitForText` 타임아웃을 5000ms로 확대.

### 2.2 Android / iOS — Bottom sheet "상태: 열림" not found

- **흐름:** `waitForVisible #sheet-status` → `swipe GestureDetector View:text("Bottom sheet")` 방향 up, 거리 30%, duration 400ms → `waitForText "상태: 열림"`.
- **앱 동작:** `StepGestureBottomSheet`는 Pan 제스처로 열림. `onEnd`에서 `velocityY < -100` 또는 `sheetOffset < BOTTOM_SHEET_HEIGHT/2`일 때 열림. 실제 표시 텍스트는 `상태: 열림 ✅` (이모지 포함). `assert_text`는 `:text()`에서 **substring** 매칭(`indexOf`)을 쓰므로 `"상태: 열림"`으로도 매칭 가능.
- **가능 원인:**
  - 스와이프 **거리 30%** 또는 **duration 400ms**가 기기/에뮬레이터에서 Pan을 "열림"으로 인식하기에 부족.
  - 스와이프 종료 후 Reanimated 스프링 애니메이션 + `setSheetOpen(true)` 반영 전에 `waitForText` 폴링이 시작되어, 5초 안에 "상태: 열림"이 보이지 않을 수 있음.
- **수정 방향:**
  - 스와이프 **거리 확대**(예: 40~50%), **duration 확대**(예: 500~600ms).
  - 스와이프 직후 **짧은 대기**(예: 500ms) 후 `waitForText` 실행해 애니메이션/상태 반영 시간 확보.

### 2.3 iOS — TouchableOpacity (0) 다음 tap 단계

- **흐름:** `waitForVisible TouchableOpacity:text("TouchableOpacity (0)")` (성공) → 그 다음 `tap` 같은 단계에서 로그가 끊김.
- **가능 원인:**
  - `waitForVisible` 직후 바로 `tap`하면, 일부 환경에서 레이아웃/measure가 아직 수렴하지 않아 `query_selector` → measure → tap 좌표가 어긋나거나, viewport clamp 후 탭이 다른 요소에 갈 수 있음.
- **수정 방향:** `waitForVisible` 직후 **짧은 대기**(예: 300ms) 후 `tap` 실행.

---

## 3. GH(아티팩트)로 확인할 것

실패 시 업로드되는 아티팩트로 다음을 확인하면 원인 파악에 도움이 됩니다.

- **Android:**  
  `e2e-artifacts/yaml-results/전체 35 스텝-step42-failure.png`  
  → "버튼 15 (0)" 탭 직후 화면인지, 스크롤 위치/버튼 가시성 확인.
- **Android (Bottom sheet):**  
  `e2e-artifacts/yaml-results/전체 35 스텝-step157-failure.png`  
  → 시트가 반쯤 열렸는지, 닫힌 상태인지 확인.
- **iOS:**  
  `e2e-artifacts/yaml-results/전체 35 스텝-step<N>-failure.png`  
  → TouchableOpacity (0) 화면에서 tap 실패 직후 스크린샷인지 확인.

워크플로:

- iOS: `.github/workflows/e2e-ios.yml` — 실패 시 `e2e-artifacts/` 업로드.
- Android: `.github/workflows/e2e-android.yml` — 동일.

---

## 4. 권장 수정 (YAML만)

데모 앱 코드는 건드리지 않고, **`examples/demo-app/e2e/all-steps.yaml`** 만 수정.

1. **Step 3 (TouchableOpacity) — iOS 탭 안정화**
   - `waitForVisible TouchableOpacity (0)` 다음에 `wait: 300` 추가 후 `tap TouchableOpacity (0)`.

2. **Step 7 (버튼 15)**
   - `scrollUntilVisible` 다음에 `wait: 500` 추가.
   - `waitForText "버튼 15 (1)"` 타임아웃을 5000ms로 확대(선택).

3. **Step 32 (Bottom sheet)**
   - `swipe` 옵션: `distance` 30% → **50%**, `duration` 400 → **600**.
   - `swipe` 직후 `wait: 500` 추가한 뒤 `waitForText "상태: 열림"` 실행.

이렇게 적용한 뒤 CI 또는 로컬에서 `전체 35 스텝`을 다시 실행해, 위 세 지점이 통과하는지 확인하면 된다.
