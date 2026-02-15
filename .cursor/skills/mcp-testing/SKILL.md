---
name: mcp-testing
description: React Native MCP 서버 전체 기능 검증 절차. 데모 앱 32개 스텝을 모두 순서대로 진행하면 MCP 내부 기능을 전부 검증한다. 클릭/탭은 query_selector → measure → tap(platform, x, y)으로 idb/adb 네이티브 터치 필수.
---

# React Native MCP 전체 기능 테스트

데모 앱(`examples/demo-app`)은 **32개 스텝**으로 구성되어 있다. **이 32개 스텝을 모두 순서대로 진행**하고, 각 스텝의 성공 기준을 만족하면 MCP 서버의 내부 기능(tap, swipe, type_text, query_selector, assert_text, evaluate_script, webview_evaluate_script, list_network_requests 등)을 전부 검증한 것이다. **스크롤은 MCP scroll 도구가 없으므로 swipe(platform, x1, y1, x2, y2)로 한다.**

**클릭/탭 (필수 흐름)**: `query_selector`(또는 take_snapshot)로 요소 찾기 → 반환된 `measure`(pageX, pageY, width, height)로 좌표 계산 → `tap(platform, x, y)`으로 idb(iOS)/adb(Android) 네이티브 클릭. JS 쪽 triggerPress가 아닌 실제 터치 주입.

**스텝 이동**: `#step-nav-next`(다음), `#step-nav-prev`(이전)으로 measure → tap.

---

## 사전 조건

- Metro: `cd examples/demo-app && npm start` (기본 포트 8230)
- 앱: `npm run ios` 또는 `npm run android` (MCP 런타임 주입됨)
- MCP 서버 연결 후 앱에서 `__REACT_NATIVE_MCP__` 사용 가능
- iOS: idb 설치·연결. Android: adb 연결.

---

## 전체 테스트: 32개 스텝 순서 (모두 진행 필수)

아래 표는 **스텝 1부터 32까지 순서대로** 진행해야 하는 전체 목록이다. 각 스텝을 완료한 뒤 다음 스텝으로 넘어가고, 32까지 모두 통과하면 MCP 내부 기능 전체 검증이 끝난다.

| Step | 구분       | 검증 요약                                                            | 사용 도구·동작                                                                                                                                               |
| ---- | ---------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1    | Press      | testID 버튼 탭 → Count 1 이상                                        | query_selector `#press-counter-button` → measure → tap → assert_text "Count: 1"                                                                              |
| 2    | Press      | testID 없음 버튼 탭                                                  | query_selector `:text("testID 없음")` → measure → tap → 숫자 증가 확인                                                                                       |
| 3    | Press      | TouchableOpacity·TouchableHighlight·Button·이미지·Icon+Label 각각 탭 | query_selector로 각 버튼 찾아 measure → tap 반복 → 각 카운트 1씩 증가 확인                                                                                   |
| 4    | Press      | 롱프레스 버튼 2개                                                    | query_selector `#press-long-press-button`, `:text("롱프레스 testID없음")` → tap(..., duration) 롱프레스 → 카운트 증가 확인                                   |
| 5    | Input      | testID 있는 TextInput에 입력                                         | type_text(uid `input-with-testid`, 문자열) → assert_text "입력값: (문자열)"                                                                                  |
| 6    | Input      | testID 없는 TextInput에 입력                                         | query_selector로 placeholder 등으로 TextInput uid 획득 → type_text → "입력값:" 확인                                                                          |
| 7    | ScrollView | scroll-view-no-ref 스크롤 후 버튼 탭                                 | **swipe**로 스크롤(ScrollView 영역에서 y1>y2) → query_selector `#scroll-btn-N` → tap → "버튼 N (1)" 확인                                                     |
| 8    | ScrollView | scroll-view-with-ref 스크롤 후 버튼 탭                               | **swipe**로 스크롤 → query_selector `#scroll-btn-N` → tap → 버튼 숫자 증가 확인                                                                              |
| 9    | ScrollView | testID 없는 ScrollView 스크롤 후 버튼 탭                             | **swipe**로 스크롤 → query_selector `:text("버튼 10")` 등 → tap → 카운트 확인                                                                                |
| 10   | FlatList   | testID 있는 FlatList 스크롤 후 탭                                    | **swipe**로 스크롤 → query_selector `#demo-app-flat-list-btn-item-N` 또는 :text("탭:") → tap → "탭: 1" 이상 assert_text                                      |
| 11   | FlatList   | testID 없는 FlatList 스크롤 후 탭                                    | **swipe**로 스크롤 → query_selector `:text("클릭:")` 등 → tap → 항목 숫자 증가 확인                                                                          |
| 12   | WebView    | WebView 내부 버튼 클릭 또는 RN 탭                                    | webview_evaluate_script(webViewId `demo-app-webview`, script로 document.querySelector("button").click()) 또는 query_selector → tap → "RN 탭 수: 1" 이상 확인 |
| 13   | WebView    | 등록 WebView ID·내부 스크립트 실행                                   | evaluate_script로 getRegisteredWebViewIds → webview_evaluate_script(`demo-app-webview-naver`, document.title 등) 결과 확인                                   |
| 14   | WebView    | testID 없는 WebView에서 postMessage 수신 확인                        | query_selector로 WebView/버튼 영역 measure → tap → assert_text "#postmessage-count"로 "postMessage 수: 1" 이상 확인                                          |
| 15   | Network    | GET /posts/1 요청·응답                                               | query_selector `#network-fetch-get` → tap → list_network_requests에서 /posts/1·응답 확인, assert_text "응답: 200"                                            |
| 16   | Network    | POST /posts status 201                                               | query_selector `#network-fetch-post` → tap → list_network_requests에서 POST·201 확인                                                                         |
| 17   | Network    | 3건 요청 수집                                                        | query_selector `#network-fetch-multiple` → tap → list_network_requests에서 users/1, todos/1, comments 3건 확인                                               |
| 18   | Network    | 404 요청 확인                                                        | query_selector `#network-fetch-error` → tap → list_network_requests 404, assert_text "응답: 404"                                                             |
| 19   | Network    | XHR GET /albums/1 캡처                                               | query_selector `#network-xhr-get` → tap → list_network_requests에서 XHR GET /albums/1 확인                                                                   |
| 20   | Gesture    | Touchable·Pressable·RNGH 3개 탭                                      | query_selector gesture-compare-touchable, gesture-compare-pressable, gesture-compare-gh-touchable → tap 각각 → 카운트 1씩 증가                               |
| 21   | Gesture    | gesture-tap-detector-wrapper 탭                                      | query_selector `#gesture-tap-detector-wrapper` → tap → assert_text로 숫자 1 이상 확인 (Gesture.Tap() idb 터치 수신)                                          |
| 22   | Gesture    | RNGH Pressable 탭                                                    | query_selector `#gesture-gh-pressable` → tap → "RNGH TouchableOpacity: 1" 이상 확인                                                                          |
| 23   | Gesture    | testID 없음 RNGH 탭                                                  | query_selector `:text("RNGH 라벨만")` → tap → 숫자 증가 확인                                                                                                 |
| 24   | Gesture    | Reanimated 트리거 탭                                                 | query_selector `#gesture-reanimated-trigger` 또는 `#gesture-reanimated-box` → tap → "눌러보세요" 아래 숫자 1 이상                                            |
| 25   | Gesture    | Reanimated 라벨만 탭                                                 | query_selector `:text("눌러보세요 (라벨만)")` → tap → 스케일 박스 숫자 증가                                                                                  |
| 26   | Gesture    | Reanimated ScrollView 스크롤                                         | **swipe**로 스크롤(해당 영역에서 y1>y2) → "Reanimated 목록 아이템 30" 등 하단 노출·스크롤 가능 확인                                                          |
| 27   | Gesture    | Swipeable 행 스와이프                                                | query_selector "스와이프 to delete 행 1" 등 → measure → swipe 왼쪽 → "삭제" 영역 노출 확인                                                                   |
| 28   | Gesture    | 드래그(Pan) 완료 카운트                                              | query_selector `#gesture-drag-area` → measure → swipe → assert_text `#gesture-drag-count` "드래그 완료: 1" 이상                                              |
| 29   | Gesture    | Pull to refresh                                                      | 화면 상단 근처에서 swipe 아래 방향 → assert_text "새로고침 횟수: 1" 이상                                                                                     |
| 30   | Gesture    | Drawer 열기·닫기                                                     | query_selector `#gesture-drawer-open` → tap → assert_text "드로워: 열림" → "닫기" 또는 drawer-overlay tap → "닫힘" 확인                                      |
| 31   | Gesture    | Pager 스와이프                                                       | 페이저 영역 measure → 가로 swipe → assert_text 또는 query_selector "현재 페이지: 1/2/3" (pager-status)                                                       |
| 32   | Gesture    | Bottom sheet 스와이프                                                | 하단 시트 영역 measure → swipe 위쪽 → assert_text "상태: 열림" 또는 sheet-status 확인                                                                        |

---

## 스텝별 사용 도구 요약

- **tap**: 항상 query_selector(또는 take_snapshot) → measure(pageX, pageY, width, height) → x = pageX + width/2, y = pageY + height/2 → tap(platform, x, y).
- **롱프레스**: tap(platform, x, y, duration) 에 duration(ms) 지정.
- **스크롤**: MCP에 scroll 도구는 없음. ScrollView/리스트 영역에서 **swipe**(platform, x1, y1, x2, y2)로 스크롤. 아래로 스크롤할 때는 y1 > y2(손가락을 위로 올리는 동작).
- **type_text**: TextInput의 uid(testID 또는 query_selector로 얻은 uid)와 입력 문자열 전달.
- **WebView**: webview_evaluate_script(webViewId, script). 등록된 WebView만 가능.
- **네트워크**: tap으로 버튼 클릭 후 list_network_requests로 URL·method·status 확인.
- **검증**: assert_text(기대 문자열), assert_visible(셀렉터).

---

## 공통 도구 사용법 (참고)

### query_selector → tap

1. `query_selector`로 요소 찾기. 예: `#press-counter-button`, `Pressable:text("testID 없음")`.
2. 반환값의 `measure`로 좌표 계산: `x = pageX + width/2`, `y = pageY + height/2`.
3. `tap(platform, x, y)` 호출.
4. `assert_text`로 결과 검증.

### 스크롤 (swipe 사용)

MCP 서버에는 **scroll 도구가 없음**. ScrollView/FlatList 스크롤은 반드시 **swipe**로 한다. ScrollView 영역 중앙 좌표에서 `swipe(platform, x1, y1, x2, y2)`: 아래로 스크롤하려면 y1 > y2(손가락을 위로 올림).

### take_snapshot

트리·uid 확인용. `take_snapshot`(옵션 maxDepth 20~30) → type·uid(testID 또는 경로) 확인.

### evaluate_script

`function: "() => typeof __REACT_NATIVE_MCP__ !== 'undefined'"`, `getRegisteredWebViewIds()` 등 앱 내 JS 실행·결과 반환.

### get_debugger_status

`connected: true`이면 list_console_messages, list_network_requests 수집 가능.

### take_screenshot

`platform: "ios"` 또는 `"android"` 지정. iOS 실기기는 시뮬레이터가 아니면 미지원일 수 있음.

---

## 체크리스트 (32 스텝 모두 완료 = 전체 기능 검증)

| Step  | 통과                                                                                         | 비고                                             |
| ----- | -------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 1~4   | ☐ Press (testID·라벨·다양한 버튼·롱프레스)                                                   | query_selector + tap / tap(..., duration)        |
| 5~6   | ☐ Input (testID 있음/없음)                                                                   | type_text                                        |
| 7~9   | ☐ ScrollView (ref 없음/있음/testID 없음)                                                     | **swipe**로 스크롤 + query_selector + tap        |
| 10~11 | ☐ FlatList (testID 있음/없음)                                                                | **swipe**로 스크롤 + tap                         |
| 12~14 | ☐ WebView (내부 클릭·스크립트·postMessage 수신 확인)                                         | webview_evaluate_script, getRegisteredWebViewIds |
| 15~19 | ☐ Network (GET·POST·multiple·error·XHR)                                                      | tap + list_network_requests                      |
| 20~32 | ☐ Gesture (비교·탭·RNGH·Reanimated·스크롤·Swipeable·드래그·Refresh·Drawer·Pager·BottomSheet) | tap, **swipe**(스크롤 포함), assert_text         |

**32개 스텝을 모두 위 순서대로 진행하고 각각 성공 기준을 만족하면, MCP 서버의 내부 기능을 전부 검증한 것이다.**

데모 앱 구조: `examples/demo-app/src/stepConfig.tsx`에 STEPS 32개 정의. 한 화면에 한 스텝만 노출되며, 하단 step-nav로 이전/다음 이동.
