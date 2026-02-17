# E2E 도구 비교: react-native-mcp vs Detox vs Maestro vs Appium

React Native 관점에서 주요 모바일 E2E 테스트 도구의 차이점을 정리한다.

---

## 아키텍처 비교

|                   | react-native-mcp           | Detox                                | Maestro                | Appium                        |
| ----------------- | -------------------------- | ------------------------------------ | ---------------------- | ----------------------------- |
| 접근 방식         | React fiber 트리 직접 접근 | 네이티브 뷰 계층 (Espresso/EarlGrey) | 접근성 트리 (블랙박스) | WebDriver 프로토콜 (블랙박스) |
| 프로토콜          | MCP (WebSocket)            | IPC (자체)                           | gRPC                   | HTTP (W3C WebDriver)          |
| 런타임 연결       | JS 번들에 runtime.js 포함  | 네이티브 모듈 + 별도 빌드 스킴       | 기기 접근성 API        | UIAutomator/XCUITest 경유     |
| 테스트 작성       | YAML / MCP tool 호출       | JavaScript (Jest)                    | YAML                   | JS, Python, Java, Ruby 등     |
| React Native 전용 | ✓                          | ✓                                    | ✗ (범용 모바일)        | ✗ (범용 모바일)               |
| 프로덕션 영향     | 없음 (`__DEV__` 조건부)    | 없음 (별도 빌드)                     | 없음                   | 없음                          |

---

## 설치 및 설정

|                    | react-native-mcp                                 | Detox                                          | Maestro                   | Appium                                          |
| ------------------ | ------------------------------------------------ | ---------------------------------------------- | ------------------------- | ----------------------------------------------- |
| 네이티브 빌드 수정 | 불필요                                           | **필수** (iOS 스킴, Android 설정)              | 불필요                    | 불필요                                          |
| 별도 빌드          | 불필요 (dev 빌드 그대로)                         | **필수** (Debug-Detox 스킴)                    | 불필요                    | 불필요                                          |
| 설치               | `import '@ohah/react-native-mcp-server/runtime'` | `detox init` + Podfile/Gradle 수정 + 빌드 설정 | `brew install maestro`    | Java + Appium 서버 + 드라이버 설치              |
| CI 설정 난이도     | 낮음 (앱 빌드 + 서버 기동)                       | 높음 (Detox 빌드 + 테스트 빌드 + 환경 설정)    | 중간 (CLI 설치 + 앱 빌드) | 높음 (Java + Appium 서버 + 드라이버 + 디바이스) |
| Expo 호환          | ✓ (동일한 JS 런타임)                             | 설정 필요 (EAS Build)                          | ✓                         | ✓                                               |

---

## 셀렉터 / 요소 탐색

| 기능                          | react-native-mcp                 | Detox                                     | Maestro         | Appium                |
| ----------------------------- | -------------------------------- | ----------------------------------------- | --------------- | --------------------- |
| testID                        | `#myId`                          | `by.id('myId')`                           | `id: "myId"`    | `By.id('myId')`       |
| 텍스트                        | `:text("로그인")`                | `by.text('로그인')`                       | `"로그인"`      | `By.text('로그인')`   |
| 컴포넌트 이름 (displayName)   | `CustomerCard`                   | ✗                                         | ✗               | ✗                     |
| `:display-name()` 의사 셀렉터 | `:display-name("Animated.View")` | ✗                                         | ✗               | ✗                     |
| 접근성 레이블                 | `[accessibilityLabel="닫기"]`    | `by.label('닫기')`                        | `label: "닫기"` | `By.label('닫기')`    |
| 타입 필터                     | `Pressable`, `ScrollView`        | `by.type('RCTView')` (네이티브 타입)      | ✗               | `By.className('...')` |
| 프레스 핸들러 유무            | `:has-press`                     | ✗                                         | ✗               | ✗                     |
| 스크롤 가능 여부              | `:has-scroll`                    | ✗                                         | ✗               | ✗                     |
| CSS-like 조합                 | `View > Pressable:text("확인")`  | 체이닝 (`withAncestor`, `withDescendant`) | ✗               | XPath (복잡)          |
| N번째 매칭                    | `:nth-of-type(2)`                | `atIndex(1)`                              | `index: 1`      | XPath index           |

**핵심 차이**: Detox/Maestro/Appium은 네이티브 뷰 계층이나 접근성 트리만 볼 수 있다. react-native-mcp는 React fiber를 직접 순회하므로 **컴포넌트 이름, props, 핸들러 유무**로 요소를 찾을 수 있다.

---

## 인스펙션 / 디버깅

| 기능                        | react-native-mcp               | Detox                     | Maestro               | Appium          |
| --------------------------- | ------------------------------ | ------------------------- | --------------------- | --------------- |
| 컴포넌트 트리 조회          | `describe()` — React 트리 전체 | ✗                         | ✗                     | 네이티브 트리만 |
| 요소 검색 + 좌표/props 반환 | `querySelector()`              | ✗                         | ✗                     | ✗               |
| 콘솔 로그 수집              | `consoleLogs()`                | ✗                         | ✗                     | ✗               |
| 네트워크 요청 모니터링      | `networkRequests()`            | ✗                         | ✗                     | ✗               |
| 앱 내 JS 실행               | `evaluate()`                   | ✗                         | `evalScript` (제한적) | ✗               |
| WebView 내부 JS 실행        | `webviewEval()`                | ✗                         | ✗                     | 컨텍스트 전환   |
| 스크린샷                    | `screenshot()`                 | `device.takeScreenshot()` | `takeScreenshot`      | `getScreenshot` |

react-native-mcp는 **테스트 도구이자 개발 중 인스펙션 도구**로 동작한다. React DevTools + Network Inspector + Console을 하나의 MCP 인터페이스로 제공.

---

## AI 에이전트 연동

| 기능              | react-native-mcp                              | Detox | Maestro | Appium |
| ----------------- | --------------------------------------------- | ----- | ------- | ------ |
| MCP 프로토콜 지원 | ✓ (표준 MCP)                                  | ✗     | ✗       | ✗      |
| AI 자율 조작      | 스크린샷 → 트리 조회 → 측정 → 제스처          | ✗     | ✗       | ✗      |
| 자연어 테스트     | AI 클라이언트 통해 가능                       | ✗     | ✗       | ✗      |
| AI 디버깅         | consoleLogs + networkRequests + describe 조합 | ✗     | ✗       | ✗      |

MCP는 표준 프로토콜이므로 Claude Code, Cursor, Windsurf 등 **어떤 MCP 클라이언트든 연결** 가능. 다른 도구에는 이 카테고리 자체가 없다.

---

## WebView 지원

| 기능                 | react-native-mcp       | Detox     | Maestro   | Appium                         |
| -------------------- | ---------------------- | --------- | --------- | ------------------------------ |
| WebView 내부 JS 실행 | ✓ (`webviewEval`)      | ✗         | ✗         | ✓ (컨텍스트 전환 후)           |
| WebView DOM 조작     | JS로 직접 가능         | ✗         | ✗         | 셀레니움 API 사용              |
| WebView 요소 탭      | JS 이벤트 또는 좌표 탭 | 좌표 탭만 | 좌표 탭만 | WebView 컨텍스트에서 셀렉터 탭 |

Appium은 WebView 컨텍스트 전환을 지원하지만, 설정이 복잡하다. react-native-mcp는 `webviewEval` 한 줄로 가능.

---

## E2E 테스트 기능 (Detox/Maestro가 앞서는 영역)

| 기능                                   | react-native-mcp | Detox                       | Maestro            | Appium             |
| -------------------------------------- | ---------------- | --------------------------- | ------------------ | ------------------ |
| 자동 동기화 (애니메이션/네트워크 대기) | ✗ (수동 wait)    | **✓** (핵심 강점)           | ✗ (수동 wait)      | ✗ (수동 wait)      |
| 반복 (repeat/loop)                     | 예정 (P1)        | JS 코드                     | `repeat`           | JS/Python 코드     |
| 조건 분기 (if/when)                    | 예정 (P1)        | JS 코드                     | `runFlow` + `when` | JS/Python 코드     |
| 서브플로우 include                     | 예정 (P0)        | JS import                   | `runFlow`          | 코드 모듈화        |
| 환경 변수                              | 예정 (P0)        | JS 환경 변수                | `${VAR}`           | 코드 레벨          |
| clearText                              | 예정 (P0)        | `clearText()`               | `eraseText`        | `clear()`          |
| back (Android)                         | 예정 (P0)        | `device.pressBack()`        | `pressKey: back`   | `driver.back()`    |
| 더블탭                                 | 예정 (P0)        | `multiTap(2)`               | `doubleTapOn`      | `doubleTap()`      |
| 핀치/줌                                | 예정 (P2)        | `pinch()`                   | ✗                  | `pinch()`          |
| GPS 모킹                               | 예정 (P2)        | `device.setLocation()`      | `setLocation`      | `setLocation()`    |
| 권한 다이얼로그                        | ✗                | `permissions` 옵션          | 자동 처리          | caps 설정          |
| 앱 상태 초기화                         | 예정 (P2)        | `launchApp({delete: true})` | `clearState`       | `removeApp()`      |
| 비디오 녹화                            | ✗                | `artifacts` 설정            | `startRecording`   | `startRecording()` |
| 네트워크 모킹                          | 예정             | URL blacklist               | ✗                  | ✗                  |
| 재시도 (retry)                         | 예정 (P2)        | ✗                           | 자동 재시도        | 코드 레벨          |

> 예정 항목의 우선순위와 구현 계획은 [e2e-yaml-roadmap.md](e2e-yaml-roadmap.md) 참고.

---

## 기타 모바일 E2E 도구

React Native에서 직접 쓰기엔 제한적이지만, 생태계의 일부인 도구들:

| 도구        | 특징                           | RN 사용 가능  | 비고                                    |
| ----------- | ------------------------------ | ------------- | --------------------------------------- |
| XCUITest    | Apple 공식. Swift로 작성       | △ (iOS만)     | 네이티브 뷰만 인식. 크로스플랫폼 불가   |
| Espresso    | Google 공식. Kotlin으로 작성   | △ (Android만) | 자동 동기화. Detox가 이걸 래핑          |
| EarlGrey    | Google iOS 테스트. 자동 동기화 | △ (iOS만)     | Detox가 이걸 래핑. 단독 사용 드뭄       |
| WebdriverIO | Appium 위 추상화 레이어        | ✓             | 웹+모바일 동일 API. Appium 단점 그대로  |
| Cavy        | RN 전용 경량 E2E               | ✓             | 사실상 유지보수 중단. ref 기반 (침투적) |

---

## testID vs accessibilityLabel

셀렉터에서 자주 혼동되는 두 속성의 차이:

```jsx
<Pressable
  testID="submit-button" // 테스트 자동화용 (사용자에게 안 보임)
  accessibilityLabel="주문 제출 버튼" // 접근성용 (스크린 리더가 읽음)
>
  <Text>제출</Text>
</Pressable>
```

| 속성                 | 목적          | 스크린 리더 | 프로덕션 유지 | iOS 매핑                  | Android 매핑         |
| -------------------- | ------------- | ----------- | ------------- | ------------------------- | -------------------- |
| `testID`             | 테스트 자동화 | 읽지 않음   | 선택          | `accessibilityIdentifier` | `view.setTag()`      |
| `accessibilityLabel` | 접근성 (a11y) | **읽음**    | **필수**      | `accessibilityLabel`      | `contentDescription` |

- **테스트에서는 testID 사용 권장** — UI 문구 변경에 영향 안 받음
- **accessibilityLabel은 사용자 경험의 일부** — 테스트 목적으로 변경하면 안 됨
- Maestro가 label을 많이 쓰는 이유: 블랙박스라 접근성 트리밖에 못 보기 때문

---

## 포지셔닝 요약

```
Detox
├─ 강점: 자동 동기화, 네이티브 레벨 안정성, 성숙한 생태계
├─ 약점: 설치/빌드 복잡, React 트리 접근 불가, AI 연동 없음
└─ 적합: 대규모 RN 프로젝트의 CI/CD 회귀 테스트

Maestro
├─ 강점: YAML 노코드, 설치 간편, 플랫폼 무관 (Flutter/Swift도 가능)
├─ 약점: 블랙박스 (React 트리 모름), WebView 불가, AI 연동 없음
└─ 적합: 빠른 스모크 테스트, 비개발자도 작성 가능한 시나리오

Appium
├─ 강점: 언어 무관, 거대 생태계, 클라우드 서비스 연동 (BrowserStack/SauceLabs)
├─ 약점: 느림 (HTTP 오버헤드), 설정 복잡, flaky
└─ 적합: 대기업 QA팀, 멀티플랫폼 통합 테스트

react-native-mcp
├─ 강점: React fiber 직접 접근, MCP AI 연동, 실시간 인스펙션, 설치 최소, WebView 브릿지
├─ 약점: 자동 동기화 없음, E2E 흐름 제어 아직 부족 (로드맵 진행 중)
└─ 적합: AI 기반 테스트/디버깅, React 컴포넌트 단위 검증, 하이브리드 앱
```

---

## 함께 사용하는 전략

이 도구들은 경쟁이 아니라 보완 관계로 사용할 수 있다:

| 용도                                       | 도구                             |
| ------------------------------------------ | -------------------------------- |
| **개발 중 디버깅 + AI 보조**               | react-native-mcp                 |
| **컴포넌트 단위 동작 검증**                | react-native-mcp (fiber 접근)    |
| **WebView 내부 테스트**                    | react-native-mcp (유일하게 가능) |
| **CI/CD 회귀 테스트 (안정성 중심)**        | Detox (자동 동기화)              |
| **빠른 스모크 테스트 / 비개발자 시나리오** | Maestro (간편함)                 |
| **대기업 QA / 클라우드 디바이스 팜**       | Appium (범용)                    |
| **AI 자율 테스트 시나리오**                | react-native-mcp (MCP)           |
