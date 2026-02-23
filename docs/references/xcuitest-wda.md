# XCUITest / WebDriverAgent 레퍼런스

iOS 실기기에서 네이티브 터치 주입이 필요할 때 사용하는 도구 체인.
idb는 시뮬레이터 전용이므로, 실기기 스와이프/드래그/핀치는 XCUITest 경유가 유일한 방법.

---

## 1. 개요

### 1.1 도구 관계도

```
┌─────────────────────────────────────────────────┐
│                    Appium                        │
│            (자동화 프레임워크, npm)                │
│     JS/Python/Java로 테스트 작성 가능             │
└──────────────────┬──────────────────────────────┘
                   │ 내부적으로 사용
                   ▼
┌─────────────────────────────────────────────────┐
│              WebDriverAgent (WDA)                │
│        (XCUITest Runner + HTTP 서버)             │
│     curl/REST API로 터치 명령 가능               │
└──────────────────┬──────────────────────────────┘
                   │ 내부적으로 사용
                   ▼
┌─────────────────────────────────────────────────┐
│                 XCUITest                         │
│          (Apple 공식 UI 테스트 프레임워크)         │
│     실기기 + 시뮬레이터 모두 터치 주입 가능        │
└─────────────────────────────────────────────────┘
```

### 1.2 한 줄 요약

| 도구         | 정체                            | 비유                   |
| ------------ | ------------------------------- | ---------------------- |
| **XCUITest** | Apple 공식 UI 테스트 프레임워크 | 엔진                   |
| **WDA**      | XCUITest를 HTTP API로 감싼 앱   | 엔진 + 리모컨          |
| **Appium**   | WDA를 자동 관리하는 프레임워크  | 엔진 + 리모컨 + 매니저 |

---

## 2. XCUITest

### 2.1 정체

- Apple이 만든 **UI 테스트 프레임워크** (Xcode 7+, 2015~)
- Swift/Objective-C로 테스트 코드 작성
- 실기기 + 시뮬레이터 모두 동작
- **단독 설치 불가** — Xcode 프로젝트의 UI Test Target으로만 존재

### 2.2 동작 구조

```
Xcode 프로젝트
├── MyApp (메인 앱 타겟)            → MyApp.app
└── MyAppUITests (UI 테스트 타겟)   → MyAppUITests-Runner.app
```

`Cmd+U` 실행 시:

```
1. MyApp.app 빌드 → 기기에 설치
2. MyAppUITests-Runner.app 빌드 → 기기에 설치 (별도 앱)
3. Runner 앱이 실행됨
4. Runner가 MyApp.app을 launch
5. Runner가 접근성 API로 MyApp을 제어
```

**핵심: Runner는 별도 앱이다.** 내 앱에 포함되는 게 아니라, 바깥에서 별도 프로세스로 내 앱을 조작한다.

### 2.3 왜 별도 앱인가?

Apple의 **샌드박스 정책** 때문:

- 앱이 자기 자신의 UI를 프로그래밍으로 조작하는 건 보안상 금지
- 별도 프로세스(Runner)에 Apple이 허용한 **비공개 접근성 API** 권한 부여
- 이 권한은 **개발자 서명 + Xcode 테스트 실행** 조건에서만 활성화

### 2.4 코드 예시

```swift
import XCTest

class MyAppUITests: XCTestCase {

    let app = XCUIApplication()

    override func setUpWithError() throws {
        continueAfterFailure = false
        app.launch()
    }

    // 버튼 탭
    func testButtonTap() {
        app.buttons["submit-btn"].tap()
        XCTAssert(app.staticTexts["Success"].exists)
    }

    // 스와이프
    func testDrawerOpen() {
        app.swipeRight()
        XCTAssert(app.staticTexts["드로워: 열림"].exists)
    }

    // 텍스트 입력
    func testTextInput() {
        let textField = app.textFields["search-input"]
        textField.tap()
        textField.typeText("검색어")
    }

    // 롱프레스
    func testLongPress() {
        app.buttons["item-1"].press(forDuration: 1.5)
        XCTAssert(app.menus.firstMatch.exists)
    }

    // 핀치
    func testPinchZoom() {
        app.pinch(withScale: 2.0, velocity: 1.0)  // 확대
        app.pinch(withScale: 0.5, velocity: -1.0)  // 축소
    }

    // 회전
    func testRotation() {
        app.rotate(CGFloat.pi / 4, withVelocity: 1.0)
    }

    // 드래그
    func testDrag() {
        let start = app.buttons["drag-handle"].coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5))
        let end = start.withOffset(CGVector(dx: 0, dy: -200))
        start.press(forDuration: 0.5, thenDragTo: end)
    }

    // 특정 좌표 탭
    func testTapCoordinate() {
        let coord = app.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.3))
        coord.tap()
    }
}
```

### 2.5 지원 제스처

| 제스처      | API                                        | 실기기 |
| ----------- | ------------------------------------------ | ------ |
| 탭          | `.tap()`                                   | ✅     |
| 더블탭      | `.doubleTap()`                             | ✅     |
| 롱프레스    | `.press(forDuration:)`                     | ✅     |
| 스와이프    | `.swipeLeft/Right/Up/Down()`               | ✅     |
| 핀치        | `.pinch(withScale:velocity:)`              | ✅     |
| 회전        | `.rotate(_:withVelocity:)`                 | ✅     |
| 드래그      | `.press(forDuration:thenDragTo:)`          | ✅     |
| 좌표 탭     | `.coordinate(withNormalizedOffset:).tap()` | ✅     |
| 텍스트 입력 | `.typeText()`                              | ✅     |
| 멀티터치    | 커스텀 (좌표 기반)                         | ✅     |

### 2.6 한계

- **Swift/ObjC 필수** — JS/Python으로 작성 불가
- **Xcode + Mac 필수** — 빌드/실행 모두 Mac에서
- **정적 테스트** — 코드를 미리 작성해야 함, 동적 조작 불가
- **느린 피드백** — 빌드 → 설치 → 실행 사이클

---

## 3. WebDriverAgent (WDA)

### 3.1 정체

- **Facebook이 만든 오픈소스** (현재 Appium 프로젝트에서 관리)
- XCUITest Runner 앱 + HTTP 서버
- REST API로 외부에서 터치 명령 가능
- 저장소: https://github.com/appium/WebDriverAgent

### 3.2 동작 구조

```
┌──────────────┐    HTTP :8100    ┌────────────────────────┐
│  클라이언트    │ ──────────────→ │   iOS 기기/시뮬레이터     │
│  (curl, JS,  │                 │                        │
│   Python 등) │ ←────────────── │  WebDriverAgentRunner   │
│              │    JSON 응답     │  .app (별도 앱)         │
└──────────────┘                 │    │                    │
                                 │    │ XCUITest API       │
                                 │    ▼                    │
                                 │  MyApp.app (내 앱)      │
                                 └────────────────────────┘
```

### 3.3 설치 방법

```bash
# 1. 소스 받기
git clone https://github.com/appium/WebDriverAgent.git
cd WebDriverAgent

# 2. 의존성 설치
./Scripts/bootstrap.sh

# 3. Xcode로 빌드 & 실행
#    - WebDriverAgentRunner 스킴 선택
#    - 타겟 디바이스 선택
#    - Cmd+U (테스트 실행)
#    → 기기에 WebDriverAgentRunner.app 설치됨
#    → HTTP 서버 시작 (기본 포트 8100)

# 4. 실기기의 경우 포트 포워딩
iproxy 8100 8100
```

**주의:** 실기기는 Apple 개발자 서명이 필요. 무료 개발자 계정도 가능하지만 7일마다 재서명.

### 3.4 HTTP API

#### 세션 생성

```bash
curl -X POST http://localhost:8100/session \
  -H "Content-Type: application/json" \
  -d '{"capabilities": {"bundleId": "com.myapp"}}'
# → {"sessionId": "xxx-xxx", ...}
```

#### 탭

```bash
# testID로 요소 찾기
curl -X POST http://localhost:8100/session/{id}/element \
  -d '{"using": "accessibility id", "value": "submit-btn"}'
# → {"ELEMENT": "element-uuid"}

# 요소 탭
curl -X POST http://localhost:8100/session/{id}/element/{element-uuid}/click

# 좌표 탭
curl -X POST http://localhost:8100/session/{id}/wda/tap \
  -d '{"x": 100, "y": 200}'
```

#### 스와이프

```bash
# 좌표 기반 스와이프
curl -X POST http://localhost:8100/session/{id}/wda/swipe \
  -d '{"fromX": 15, "fromY": 400, "toX": 250, "toY": 400, "duration": 0.3}'

# 요소 기반 스와이프
curl -X POST http://localhost:8100/session/{id}/wda/element/{id}/swipe \
  -d '{"direction": "right"}'
```

#### 텍스트 입력

```bash
# 요소에 텍스트 입력
curl -X POST http://localhost:8100/session/{id}/element/{id}/value \
  -d '{"text": "검색어"}'

# 키보드 입력
curl -X POST http://localhost:8100/session/{id}/wda/keys \
  -d '{"value": ["h", "e", "l", "l", "o"]}'
```

#### 핀치/줌

```bash
# 핀치 (축소)
curl -X POST http://localhost:8100/session/{id}/wda/element/{id}/pinch \
  -d '{"scale": 0.5, "velocity": -1.0}'

# 줌 (확대)
curl -X POST http://localhost:8100/session/{id}/wda/element/{id}/pinch \
  -d '{"scale": 2.0, "velocity": 1.0}'
```

#### 롱프레스 / 드래그

```bash
# 롱프레스
curl -X POST http://localhost:8100/session/{id}/wda/touchAndHold \
  -d '{"x": 100, "y": 200, "duration": 1.5}'

# 드래그
curl -X POST http://localhost:8100/session/{id}/wda/dragfromtoforduration \
  -d '{"fromX": 100, "fromY": 400, "toX": 100, "toY": 200, "duration": 0.5}'
```

#### 스크린샷

```bash
curl http://localhost:8100/screenshot
# → {"value": "<base64 PNG>"}
```

#### 요소 찾기

```bash
# accessibility id (testID)
curl -X POST http://localhost:8100/session/{id}/element \
  -d '{"using": "accessibility id", "value": "submit-btn"}'

# class name
curl -X POST http://localhost:8100/session/{id}/element \
  -d '{"using": "class name", "value": "XCUIElementTypeButton"}'

# predicate string
curl -X POST http://localhost:8100/session/{id}/element \
  -d '{"using": "predicate string", "value": "label == \"Submit\""}'

# class chain
curl -X POST http://localhost:8100/session/{id}/element \
  -d '{"using": "class chain", "value": "**/XCUIElementTypeButton[`label == \"Submit\"`]"}'
```

#### 소스 트리 (접근성 트리)

```bash
# XML 형식
curl http://localhost:8100/session/{id}/source

# JSON 형식
curl http://localhost:8100/session/{id}/source?format=json
```

### 3.5 지원 기능 전체

| 기능          | API 엔드포인트                      | 비고                                     |
| ------------- | ----------------------------------- | ---------------------------------------- |
| 탭            | `POST /wda/tap`                     | 좌표 기반                                |
| 더블탭        | `POST /wda/doubleTap`               |                                          |
| 롱프레스      | `POST /wda/touchAndHold`            | duration 지정                            |
| 스와이프      | `POST /wda/swipe`                   | 좌표 + duration                          |
| 핀치/줌       | `POST /wda/element/{id}/pinch`      | scale + velocity                         |
| 회전          | `POST /wda/element/{id}/rotate`     | rotation + velocity                      |
| 드래그        | `POST /wda/dragfromtoforduration`   | from/to + duration                       |
| 텍스트 입력   | `POST /element/{id}/value`          | 한글 포함 유니코드                       |
| 키보드        | `POST /wda/keys`                    | 키 배열                                  |
| 스크린샷      | `GET /screenshot`                   | base64 PNG                               |
| 소스 트리     | `GET /session/{id}/source`          | XML/JSON                                 |
| 요소 찾기     | `POST /session/{id}/element`        | accessibility id, predicate, class chain |
| 앱 실행       | `POST /wda/apps/launch`             | bundleId                                 |
| 앱 종료       | `POST /wda/apps/terminate`          | bundleId                                 |
| 앱 상태       | `POST /wda/apps/state`              | foreground/background 등                 |
| 화면 잠금     | `POST /wda/lock`                    |                                          |
| 화면 해제     | `POST /wda/unlock`                  |                                          |
| HOME 버튼     | `POST /wda/homescreen`              |                                          |
| 알림 처리     | `POST /session/{id}/alert/accept`   | 권한 팝업 등                             |
| 화면 방향     | `GET/SET /session/{id}/orientation` | PORTRAIT/LANDSCAPE                       |
| 배터리        | `GET /session/{id}/wda/batteryInfo` |                                          |
| 디바이스 정보 | `GET /session/{id}/wda/device/info` |                                          |

---

## 4. Appium (WDA 매니저)

### 4.1 정체

- **오픈소스 크로스플랫폼 자동화 프레임워크**
- iOS에서는 내부적으로 WDA를 자동 설치/관리
- Android에서는 UiAutomator2 사용
- 저장소: https://github.com/appium/appium

### 4.2 설치

```bash
npm install -g appium
appium driver install xcuitest   # iOS 드라이버 (WDA 포함)
appium driver install uiautomator2  # Android 드라이버
appium  # 서버 시작 (기본 포트 4723)
```

### 4.3 WDA와의 차이

|               | WDA 직접 사용      | Appium 사용               |
| ------------- | ------------------ | ------------------------- |
| WDA 빌드/설치 | 수동 (Xcode)       | **자동**                  |
| WDA 서명 관리 | 수동               | **자동**                  |
| 포트 관리     | 수동 (iproxy)      | **자동**                  |
| API           | WDA REST 직접 호출 | WebDriver 표준 프로토콜   |
| Android 지원  | ❌                 | ✅ (UiAutomator2)         |
| 테스트 코드   | curl/HTTP 직접     | JS/Python/Java 클라이언트 |

### 4.4 코드 예시 (JavaScript)

```javascript
const { remote } = require('webdriverio');

const driver = await remote({
  hostname: 'localhost',
  port: 4723,
  capabilities: {
    platformName: 'iOS',
    'appium:deviceName': 'iPhone 15 Pro',
    'appium:bundleId': 'com.myapp',
    'appium:automationName': 'XCUITest',
  },
});

// 탭
const btn = await driver.$('~submit-btn'); // accessibility id
await btn.click();

// 스와이프
await driver.touchAction([
  { action: 'press', x: 15, y: 400 },
  { action: 'wait', ms: 300 },
  { action: 'moveTo', x: 250, y: 400 },
  { action: 'release' },
]);

// 텍스트 확인
const text = await driver.$('~drawer-status').getText();
assert(text.includes('열림'));
```

---

## 5. 도구 비교 총정리

### 5.1 기능 비교

| 기능            | MCP        | idb       | WDA        | XCUITest     | Appium       |
| --------------- | ---------- | --------- | ---------- | ------------ | ------------ |
| 탭              | ✅ JS      | ✅ 시뮬만 | ✅         | ✅           | ✅           |
| 스와이프        | ❌         | ✅ 시뮬만 | ✅         | ✅           | ✅           |
| 핀치/회전       | ❌         | ❌        | ✅         | ✅           | ✅           |
| 멀티터치        | ❌         | ❌        | ✅         | ✅           | ✅           |
| 텍스트 입력     | ✅ JS      | ⚠️ 영문만 | ✅         | ✅           | ✅           |
| 스크롤          | ✅ JS      | ✅ swipe  | ✅         | ✅           | ✅           |
| 스크린샷        | ❌         | ✅ 시뮬만 | ✅         | ✅           | ✅           |
| 요소 찾기       | ✅ Fiber   | ✅ 접근성 | ✅ 접근성  | ✅ 접근성    | ✅ 접근성    |
| 콘솔 로그       | ✅         | ❌        | ❌         | ❌           | ✅ (logcat)  |
| 네트워크 모니터 | ✅         | ❌        | ❌         | ❌           | ❌           |
| 실기기          | ✅ JS부분  | ❌ 터치   | ✅         | ✅           | ✅           |
| 설치 난이도     | Babel만    | pip       | Xcode 빌드 | Xcode        | npm + 자동   |
| 동적 조작       | ✅ AI 대화 | ✅ CLI    | ✅ REST    | ❌ 정적 코드 | ⚠️ 코드 작성 |

### 5.2 실행 환경별 권장 조합

| 환경                             | 권장 조합         | 이유                         |
| -------------------------------- | ----------------- | ---------------------------- |
| **iOS 시뮬레이터**               | MCP + idb         | 가장 간편, 셋업 최소         |
| **iOS 실기기 (JS 조작만)**       | MCP만             | 탭/스크롤/입력 충분          |
| **iOS 실기기 (네이티브 제스처)** | MCP + Appium(WDA) | 실기기 스와이프/핀치 필요 시 |
| **Android 에뮬레이터**           | MCP + adb         | idb 대응, 더 풍부한 기능     |
| **Android 실기기**               | MCP + adb         | USB 연결만으로 전체 동작     |
| **크로스플랫폼 CI**              | MCP + Appium      | iOS/Android 동일 API         |

### 5.3 MCP와의 조합 시 역할 분담

```
MCP (앱 내부, JS 레벨)
├── 요소 찾기 (query_selector, Fiber 기반)
├── 텍스트 확인 (assert_text)
├── JS 콜백 호출 (click, scroll, type_text)
├── 콘솔/네트워크 모니터링
└── WebView JS 실행

idb / adb / WDA (앱 외부, 시스템 레벨)
├── 네이티브 터치 주입 (tap, swipe, pinch)
├── 스크린샷/화면 녹화
├── 앱 설치/실행/종료
├── 권한 관리
└── 디바이스 설정 (GPS, 네트워크 등)
```

---

## 6. MCP 서버에서 WDA 연동 (향후 설계)

MCP 서버가 WDA HTTP API를 직접 호출하는 구조:

```
┌──────────┐   MCP    ┌──────────────┐   HTTP    ┌──────────────┐
│ AI Agent │ ──────→  │  MCP Server  │ ───────→  │     WDA      │
│          │          │              │           │  (기기 위)    │
│          │ ←──────  │  - Fiber조회  │ ←───────  │              │
│          │  결과    │  - WDA 프록시 │   결과    │  XCUITest    │
└──────────┘          └──────────────┘           └──────────────┘
```

가능한 MCP 도구 확장:

```typescript
// 새 MCP 도구 (안)
{
  name: "native_tap",
  description: "System-level tap via WDA/idb/adb",
  params: { x: number, y: number }
}

{
  name: "native_swipe",
  description: "System-level swipe via WDA/idb/adb",
  params: { fromX, fromY, toX, toY, duration }
}

{
  name: "native_pinch",
  description: "Pinch gesture via WDA (iOS) / sendevent (Android)",
  params: { scale: number, velocity: number }
}
```

이렇게 하면 AI Agent 입장에서는 MCP 도구만 호출하면 되고,
MCP 서버가 플랫폼에 따라 idb/adb/WDA를 자동 선택.
