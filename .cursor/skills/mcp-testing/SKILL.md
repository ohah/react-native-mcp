---
name: mcp-testing
description: React Native MCP 서버 각 도구 기능을 데모 앱으로 검증하는 방법. 클릭/탭은 무조건 query_selector로 좌표 획득 → tap(platform, x, y)으로 idb/adb 네이티브 클릭. take_snapshot, scroll, assert_text, 콘솔/네트워크 수집 확인 시 참고.
---

# React Native MCP 기능 테스트 가이드

데모 앱(`examples/demo-app`)이 실행 중이고 MCP 서버에 연결된 상태에서, 각 도구별로 어떻게 검증하는지 정리한다.

**클릭/탭 흐름 (필수)**: `query_selector`(또는 take_snapshot)로 요소 찾기 → 반환된 `measure`(pageX, pageY, width, height)로 좌표 계산 → `tap(platform, x, y)`으로 idb(iOS)/adb(Android) 네이티브 클릭. JS 쪽 triggerPress/click이 아닌 실제 터치 주입.

## 사전 조건

- Metro: `cd examples/demo-app && npm start` (기본 포트 8230)
- 앱: `npm run ios` 또는 `npm run android` (MCP 런타임 주입됨)
- MCP 서버: 연결 후 앱에서 `__REACT_NATIVE_MCP__` 사용 가능

---

## 1. take_snapshot

**목적**: Fiber 컴포넌트 트리(타입/testID/자식) 조회. uid로 요소 탐색.

**테스트 절차**

1. `take_snapshot` 호출 (옵션: `maxDepth` 20~30 권장).
2. 반환 JSON에서 확인:
   - **ScrollView**: `type: "ScrollView"`, testID 있으면 `uid: "demo-app-scroll-view"`, 없으면 `uid: "0.1.x"` 형태 경로.
   - **FlatList**: `type: "FlatList"` 또는 "VirtualizedList", testID 있으면 `uid: "demo-app-flat-list"`.
   - **버튼**: `uid: "demo-app-counter-button"`, `uid: "tab-scroll"` 등.
3. 데모 앱에서:
   - ScrollView 탭: testID 있는 ScrollView 블록 / testID 없는 ScrollView 블록 둘 다 노드로 보이는지 확인.
   - FlatList 탭: testID 있는 FlatList / testID 없는 FlatList 둘 다 확인.

**성공 기준**: 트리에 ScrollView, FlatList, Pressable 등이 type으로 나오고, testID가 있으면 uid가 testID와 일치한다.

---

## 2. tap (query_selector → 좌표 → idb/adb 클릭)

**목적**: RN 요소를 클릭할 때는 반드시 query_selector로 요소를 찾고, measure로 좌표를 얻은 뒤 tap(platform, x, y)으로 idb(iOS)/adb(Android) 네이티브 터치를 주입한다.

**테스트 절차**

1. `query_selector`로 요소 찾기. 예: `#press-counter-button`, `Pressable:text("testID 없음")`.
2. 반환값의 `measure`(pageX, pageY, width, height)로 탭할 좌표 계산. 보통 중앙: `x = pageX + width/2`, `y = pageY + height/2`.
3. `tap(platform: "ios" | "android", x, y)` 호출. iOS는 idb, Android는 adb로 실제 터치 주입.
4. 앱에서 해당 버튼이 눌린 것처럼 동작하는지(예: Count 증가) `assert_text`로 확인.

**데모 앱 셀렉터 예시**

| 셀렉터 / testID                 | 동작                                                           |
| ------------------------------- | -------------------------------------------------------------- |
| `#press-counter-button`         | Count 증가                                                     |
| `Pressable:text("testID 없음")` | testID 없는 버튼 탭                                            |
| `#scroll-view-no-ref` 등        | ScrollView → scroll 도구로 스크롤 후 버튼 query_selector → tap |

**성공 기준**: tap 호출 후 앱에서 해당 요소가 눌린 것처럼 동작하고, assert_text로 결과 검증 가능.

---

## 3. list_clickables

**목적**: 클릭 가능한 요소 목록(uid + label). 스냅샷 전에 어떤 testID로 클릭할 수 있는지 파악용.

**테스트 절차**

1. ScrollView 탭 또는 FlatList 탭에서 `list_clickables` 호출.
2. 반환 배열에 `{ uid, label }` 형태로 testID와 라벨이 나오는지 확인.
3. `click(uid)`에 여기 나온 uid를 넣어 동작하는지 교차 확인.

**성공 기준**: Pressable/TouchableOpacity 등 onPress+testID 조합이 목록에 포함된다.

---

## 4. scroll

**목적**: testID로 등록된 ScrollView를 scrollTo({ x, y, animated })로 스크롤. 앱에서 `__REACT_NATIVE_MCP__.registerScrollRef(testID, ref)`로 등록 필요(Babel이 ScrollView에 ref 자동 주입).

**테스트 절차**

1. `take_snapshot`으로 ScrollView의 uid(testID) 확인. 예: `demo-app-scroll-view`, `demo-app-scroll-view-with-ref`.
2. `scroll` 호출 시 `uid`에 해당 testID, `y`에 픽셀 오프셋(예: 200). 선택: `x`, `animated`.
3. 데모 앱 ScrollView 탭에서 testID 있는 블록이 스크롤되면 성공.

**데모 앱 uid 예시**

| uid                             | 동작                  |
| ------------------------------- | --------------------- |
| `demo-app-scroll-view`          | ref 없음 → Babel 주입 |
| `demo-app-scroll-view-with-ref` | ref 있음 → Babel 합성 |

**성공 기준**: 반환에 스크롤 완료 메시지가 오고, 앱에서 해당 ScrollView가 움직인다.

---

## 5. list_clickable_text_content

**목적**: onPress 있는 노드별 전체 텍스트(textContent) 목록. 버튼/클릭 영역 표시 텍스트 검증용. `[{ text, testID? }]` 반환.

**테스트 절차**

1. ScrollView 탭 또는 FlatList 탭에서 `list_clickable_text_content` 호출.
2. 반환 배열에 각 클릭 가능 요소의 전체 텍스트와(선택) testID가 나오는지 확인.
3. `list_clickables`(uid+label)와 비교해, 같은 노드가 text로 더 풀어서 나오는지 확인.

**성공 기준**: onPress가 있는 노드들의 textContent가 배열로 나온다.

---

## 6. list_text_nodes

**목적**: Fiber 트리에서 보이는 텍스트 전부. testID는 조상 중 가장 가까운 testID.

**테스트 절차**

1. `list_text_nodes` 호출.
2. 반환 배열에 "React Native MCP Demo", "Count: 0", "testID 없음", "ScrollView", "FlatList" 등 데모 앱 텍스트가 포함되는지 확인.
3. `click_by_label`에 넣을 라벨 후보로 활용.

**성공 기준**: 현재 화면에 보이는 문구들이 배열로 나온다.

---

## 7. take_screenshot

**목적**: 연결된 Android 기기 또는 iOS 시뮬레이터 화면 캡처.

**테스트 절차**

1. `take_screenshot` 호출 시 `platform: "android"` 또는 `platform: "ios"` 필수.
2. 반환에 이미지(PNG 등)가 포함되는지 확인.
3. iOS 실기기는 xcrun simctl 미지원이므로 시뮬레이터에서만 검증.

**성공 기준**: 현재 앱 화면이 캡처되어 반환된다.

---

## 8. evaluate_script

**목적**: 앱 컨텍스트에서 JavaScript 실행. 디버깅·상태 조회·triggerPress 등 내부 호출에 사용.

**테스트 절차**

1. `evaluate_script` 호출. 예: `function: "() => typeof __REACT_NATIVE_MCP__ !== 'undefined'"`, `args: []`.
2. 반환 결과가 `true`인지 확인.
3. 예: `function: "() => __REACT_NATIVE_MCP__.getRegisteredPressTestIDs()"` → 등록된 testID 배열 반환 확인.

**성공 기준**: 전달한 함수가 앱에서 실행되고, 직렬화 가능한 결과가 반환된다.

---

## 9. list_console_messages / get_console_message

**목적**: CDP를 통해 수집된 콘솔 로그/경고/에러 목록.

**테스트 절차**

1. 앱에서 "Console" 버튼 클릭: `click` uid `demo-app-console-button`.
2. `list_console_messages` 호출 (옵션: `types: ["log","warning"]`).
3. 반환 목록에 데모 앱에서 출력한 로그/경고가 포함되는지 확인.
4. `get_console_message`에 `msgid`를 넘겨 단건 조회.

**사전 조건**: Metro에 CDP 가로채기 연결됨. `get_debugger_status`로 connected 여부 확인.

**성공 기준**: Console 버튼 누른 뒤 list_console_messages에 해당 메시지가 보인다.

---

## 10. list_network_requests / get_network_request

**목적**: CDP로 수집된 네트워크 요청 목록.

**테스트 절차**

1. 앱에서 "Network" 버튼 클릭: `click` uid `demo-app-network-button`.
2. `list_network_requests` 호출.
3. httpbin.org 요청이 목록에 있는지 확인.
4. `get_network_request`에 `reqid`(requestId) 전달해 단건 조회.

**사전 조건**: CDP 연결됨. `get_debugger_status`가 connected.

**성공 기준**: Network 버튼 누른 뒤 list_network_requests에 해당 요청이 보인다.

---

## 11. get_debugger_status

**목적**: CDP WebSocket 연결 여부. 콘솔/네트워크 수집 가능 여부 판단.

**테스트 절차**

1. 앱이 Metro에 연결된 상태에서 `get_debugger_status` 호출.
2. `connected: true`이면 list_console_messages, list_network_requests가 이벤트를 수집 중.

**성공 기준**: 앱 실행 + Metro 연결 시 connected가 true이다.

---

## 12. get_by_label / get_by_labels

**목적**: 라벨로 클릭 가능한 노드 검색 디버깅. click_by_label이 안 될 때 원인 확인.

**테스트 절차**

1. `get_by_label`에 `label: "testID 없음"` 등 부분 문자열 전달.
2. 반환에 `hookPresent`, `rendererPresent`, `rootPresent`, `labelsWithOnPress`, `match` 등이 포함되는지 확인.
3. `match`가 있으면 해당 라벨로 pressByLabel 가능.

**성공 기준**: 훅/렌더러/root 존재 여부와, onPress 있는 노드의 라벨 목록을 확인할 수 있다.

---

## 13. webview_evaluate_script

**목적**: 앱 내 WebView에서 임의 JS 실행 및 결과 수신. WebView가 `__REACT_NATIVE_MCP__.registerWebView(ref, id)`로 등록되어 있어야 함. Babel이 testID 있는 WebView에 ref·onMessage 자동 주입.

**테스트 절차**

1. WebView 탭으로 이동 후, `webview_evaluate_script`에 `webViewId`(예: demo-app-webview), `script`(예: `document.querySelector('h1').innerText`) 전달.
2. 결과가 도구 응답으로 반환되는지 확인. DOM 클릭은 `document.querySelector(selector).click()` 등으로 실행 가능.

**성공 기준**: 등록된 WebView 내부에서 스크립트가 실행되고, 반환값이 MCP 응답으로 온다.

---

## 체크리스트 (요약)

| 도구                        | 확인 항목                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------ |
| take_snapshot               | Scroll 탭(세그먼트 ScrollView/FlatList)에서 type·uid(testID vs 경로)                 |
| query_selector + tap        | 요소 찾기 → measure 좌표 → tap(platform, x, y)으로 idb/adb 네이티브 클릭 (필수 흐름) |
| list_clickables             | uid·label 목록 (tap 시 query_selector로 해당 요소 찾아 좌표 획득 후 tap)             |
| scroll                      | uid(testID)로 ScrollView scrollTo, Babel ref 등록 (Scroll 탭 내)                     |
| list_clickable_text_content | onPress 노드별 textContent, [{ text, testID? }]                                      |
| list_text_nodes             | 화면 텍스트 목록                                                                     |
| take_screenshot             | platform 지정 시 이미지 반환                                                         |
| evaluate_script             | **REACT_NATIVE_MCP** 존재·getRegisteredPressTestIDs 등                               |
| list_console_messages       | Interact → Press 세그먼트에서 Console 버튼 후 로그/경고 수집                         |
| list_network_requests       | Interact → Press 세그먼트에서 Network 버튼 후 httpbin 요청 수집                      |
| get_debugger_status         | connected: true                                                                      |
| list_pages                  | 단일 페이지(React Native App) 반환                                                   |
| get_by_label                | 훅·라벨 목록·match                                                                   |
| webview_evaluate_script     | WebView 탭에서 등록 WebView 내 JS 실행·결과 반환                                     |

데모 앱 구조: 하단 5탭(Scroll / Interact / WebView / Network / Gesture). Scroll은 세그먼트 ScrollView·FlatList, Interact는 Press·Input. `examples/demo-app/src/` 참고.
