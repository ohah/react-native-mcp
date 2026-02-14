---
name: mcp-testing
description: React Native MCP 서버 각 도구 기능을 데모 앱으로 검증하는 방법. take_snapshot, click, click_by_label, scroll, list_clickable_text_content, 콘솔/네트워크 수집 확인 시 참고.
---

# React Native MCP 기능 테스트 가이드

데모 앱(`examples/demo-app`)이 실행 중이고 MCP 서버에 연결된 상태에서, 각 도구별로 어떻게 검증하는지 정리한다.

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
   - **버튼**: `uid: "demo-app-counter-button"`, `uid: "demo-app-tab-scroll"` 등.
3. 데모 앱에서:
   - ScrollView 탭: testID 있는 ScrollView 블록 / testID 없는 ScrollView 블록 둘 다 노드로 보이는지 확인.
   - FlatList 탭: testID 있는 FlatList / testID 없는 FlatList 둘 다 확인.

**성공 기준**: 트리에 ScrollView, FlatList, Pressable 등이 type으로 나오고, testID가 있으면 uid가 testID와 일치한다.

---

## 2. click

**목적**: testID(uid)로 해당 요소의 onPress 호출.

**테스트 절차**

1. `take_snapshot`으로 uid 확인 (또는 `list_clickables`).
2. `click` 호출 시 `uid`에 testID 전달. 예: `uid: "demo-app-counter-button"`.
3. 앱에서 Count 숫자가 증가하면 성공.
4. **testID 없는 요소**: uid가 경로(예: "0.1.5")인 경우, `click(uid)`는 대부분 실패(triggerPress는 testID만 등록). 대신 `click_by_label` 사용.

**데모 앱 uid 예시**

| uid                       | 동작                                               |
| ------------------------- | -------------------------------------------------- |
| `demo-app-counter-button` | Count 증가                                         |
| `demo-app-tab-scroll`     | ScrollView 탭 선택                                 |
| `demo-app-tab-list`       | FlatList 탭 선택                                   |
| `demo-app-console-button` | 콘솔 로그/경고 출력 → list_console_messages로 확인 |
| `demo-app-network-button` | httpbin 요청 → list_network_requests로 확인        |

**성공 기준**: 반환에 "pressed"가 오고, 앱에서 해당 버튼이 눌린 것처럼 동작한다.

---

## 3. click_by_label

**목적**: 화면 텍스트(라벨)로 onPress 있는 요소를 찾아 클릭. testID 없어도 동작.

**테스트 절차**

1. `list_text_nodes` 또는 스냅샷으로 화면에 보이는 텍스트 확인.
2. `click_by_label` 호출 시 `label`에 부분 문자열 전달. 예: `label: "testID 없음"`, `label: "ScrollView"`(탭 버튼).
3. DevTools 훅(`__REACT_DEVTOOLS_GLOBAL_HOOK__`)이 있어야 동작. Metro + **DEV** 환경에서는 보통 존재.

**데모 앱 라벨 예시**

- `"testID 없음"` → testID 없는 버튼 (탭 수 증가)
- `"TouchableOpacity"` → 해당 버튼
- `"FlatList"` → 하단 FlatList 탭

**성공 기준**: 반환에 "pressed (Fiber에서 라벨로 찾아 onPress 호출됨)"가 온다. 실패 시 `get_by_label`로 훅/라벨 목록 디버깅.

---

## 4. list_clickables

**목적**: 클릭 가능한 요소 목록(uid + label). 스냅샷 전에 어떤 testID로 클릭할 수 있는지 파악용.

**테스트 절차**

1. ScrollView 탭 또는 FlatList 탭에서 `list_clickables` 호출.
2. 반환 배열에 `{ uid, label }` 형태로 testID와 라벨이 나오는지 확인.
3. `click(uid)`에 여기 나온 uid를 넣어 동작하는지 교차 확인.

**성공 기준**: Pressable/TouchableOpacity 등 onPress+testID 조합이 목록에 포함된다.

---

## 5. scroll

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

## 6. list_clickable_text_content

**목적**: onPress 있는 노드별 전체 텍스트(textContent) 목록. 버튼/클릭 영역 표시 텍스트 검증용. `[{ text, testID? }]` 반환.

**테스트 절차**

1. ScrollView 탭 또는 FlatList 탭에서 `list_clickable_text_content` 호출.
2. 반환 배열에 각 클릭 가능 요소의 전체 텍스트와(선택) testID가 나오는지 확인.
3. `list_clickables`(uid+label)와 비교해, 같은 노드가 text로 더 풀어서 나오는지 확인.

**성공 기준**: onPress가 있는 노드들의 textContent가 배열로 나온다.

---

## 7. list_text_nodes

**목적**: Fiber 트리에서 보이는 텍스트 전부. testID는 조상 중 가장 가까운 testID.

**테스트 절차**

1. `list_text_nodes` 호출.
2. 반환 배열에 "React Native MCP Demo", "Count: 0", "testID 없음", "ScrollView", "FlatList" 등 데모 앱 텍스트가 포함되는지 확인.
3. `click_by_label`에 넣을 라벨 후보로 활용.

**성공 기준**: 현재 화면에 보이는 문구들이 배열로 나온다.

---

## 8. take_screenshot

**목적**: 연결된 Android 기기 또는 iOS 시뮬레이터 화면 캡처.

**테스트 절차**

1. `take_screenshot` 호출 시 `platform: "android"` 또는 `platform: "ios"` 필수.
2. 반환에 이미지(PNG 등)가 포함되는지 확인.
3. iOS 실기기는 xcrun simctl 미지원이므로 시뮬레이터에서만 검증.

**성공 기준**: 현재 앱 화면이 캡처되어 반환된다.

---

## 9. evaluate_script

**목적**: 앱 컨텍스트에서 JavaScript 실행. 디버깅·상태 조회·triggerPress 등 내부 호출에 사용.

**테스트 절차**

1. `evaluate_script` 호출. 예: `function: "() => typeof __REACT_NATIVE_MCP__ !== 'undefined'"`, `args: []`.
2. 반환 결과가 `true`인지 확인.
3. 예: `function: "() => __REACT_NATIVE_MCP__.getRegisteredPressTestIDs()"` → 등록된 testID 배열 반환 확인.

**성공 기준**: 전달한 함수가 앱에서 실행되고, 직렬화 가능한 결과가 반환된다.

---

## 10. list_console_messages / get_console_message

**목적**: CDP를 통해 수집된 콘솔 로그/경고/에러 목록.

**테스트 절차**

1. 앱에서 "Console" 버튼 클릭: `click` uid `demo-app-console-button`.
2. `list_console_messages` 호출 (옵션: `types: ["log","warning"]`).
3. 반환 목록에 데모 앱에서 출력한 로그/경고가 포함되는지 확인.
4. `get_console_message`에 `msgid`를 넘겨 단건 조회.

**사전 조건**: Metro에 CDP 가로채기 연결됨. `get_debugger_status`로 connected 여부 확인.

**성공 기준**: Console 버튼 누른 뒤 list_console_messages에 해당 메시지가 보인다.

---

## 11. list_network_requests / get_network_request

**목적**: CDP로 수집된 네트워크 요청 목록.

**테스트 절차**

1. 앱에서 "Network" 버튼 클릭: `click` uid `demo-app-network-button`.
2. `list_network_requests` 호출.
3. httpbin.org 요청이 목록에 있는지 확인.
4. `get_network_request`에 `reqid`(requestId) 전달해 단건 조회.

**사전 조건**: CDP 연결됨. `get_debugger_status`가 connected.

**성공 기준**: Network 버튼 누른 뒤 list_network_requests에 해당 요청이 보인다.

---

## 12. get_debugger_status

**목적**: CDP WebSocket 연결 여부. 콘솔/네트워크 수집 가능 여부 판단.

**테스트 절차**

1. 앱이 Metro에 연결된 상태에서 `get_debugger_status` 호출.
2. `connected: true`이면 list_console_messages, list_network_requests가 이벤트를 수집 중.

**성공 기준**: 앱 실행 + Metro 연결 시 connected가 true이다.

---

## 13. get_metro_url / list_pages

**목적**: Metro base URL 조회; RN은 단일 앱이라 list_pages는 페이지 1개 반환.

**테스트 절차**

1. `get_metro_url`: 앱에서 전달한 Metro origin 반환 확인.
2. `list_pages`: 단일 페이지(React Native App) 반환 확인.

**성공 기준**: URL이 나오고, list_pages 길이가 1이다.

---

## 14. get_by_label / get_by_labels

**목적**: 라벨로 클릭 가능한 노드 검색 디버깅. click_by_label이 안 될 때 원인 확인.

**테스트 절차**

1. `get_by_label`에 `label: "testID 없음"` 등 부분 문자열 전달.
2. 반환에 `hookPresent`, `rendererPresent`, `rootPresent`, `labelsWithOnPress`, `match` 등이 포함되는지 확인.
3. `match`가 있으면 해당 라벨로 pressByLabel 가능.

**성공 기준**: 훅/렌더러/root 존재 여부와, onPress 있는 노드의 라벨 목록을 확인할 수 있다.

---

## 15. click_webview

**목적**: 앱 내 WebView에서 CSS selector로 요소 클릭. WebView가 `__REACT_NATIVE_MCP__.registerWebView(ref, id)`로 등록되어 있어야 함.

**테스트 절차**

1. 데모 앱에는 기본 WebView가 없으므로, WebView를 띄우는 화면이 있을 때만 테스트.
2. 앱 코드에서 `registerWebView(ref, id)` 호출 후, `click_webview`에 `webViewId`, `selector` 전달.

**성공 기준**: 등록된 WebView 내부의 selector 요소가 클릭된다.

---

## 체크리스트 (요약)

| 도구                        | 확인 항목                                              |
| --------------------------- | ------------------------------------------------------ |
| take_snapshot               | ScrollView/FlatList type·uid(testID vs 경로)           |
| click                       | testID로 버튼 눌림, Count/탭 전환 등                   |
| click_by_label              | "testID 없음" 등 라벨로 버튼 눌림                      |
| list_clickables             | uid·label 목록, click과 일치                           |
| scroll                      | uid(testID)로 ScrollView scrollTo, Babel ref 등록      |
| list_clickable_text_content | onPress 노드별 textContent, [{ text, testID? }]        |
| list_text_nodes             | 화면 텍스트 목록                                       |
| take_screenshot             | platform 지정 시 이미지 반환                           |
| evaluate_script             | **REACT_NATIVE_MCP** 존재·getRegisteredPressTestIDs 등 |
| list_console_messages       | Console 버튼 후 로그/경고 수집                         |
| list_network_requests       | Network 버튼 후 httpbin 요청 수집                      |
| get_debugger_status         | connected: true                                        |
| get_metro_url / list_pages  | URL·단일 페이지 반환                                   |
| get_by_label                | 훅·라벨 목록·match                                     |
| click_webview               | 등록 WebView 내 selector 클릭                          |

데모 앱 구조(ScrollView 탭 / FlatList 탭, testID 있음·없음 블록)는 `examples/demo-app/src/` 참고.
