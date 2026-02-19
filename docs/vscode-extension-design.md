# VS Code 확장 설계 문서

react-native-mcp의 MCP 도구들을 VS Code GUI로 제공하는 확장 설계.

---

## 목표

현재 MCP 도구는 AI 채팅창에서 텍스트로만 상호작용한다. VS Code 확장으로 **GUI 패널**을 만들어 AI 없이도 직접 눈으로 보고 조작할 수 있게 한다.

---

## UI 배치

```
┌─────────────────────────────────────────────────────┐
│  ① 상태바 (StatusBar)               하단 얇은 줄   │
│     🟢 RN MCP: ios-1 connected                      │
├──────────┬──────────────────────────────────────────┤
│          │                                          │
│ ② 사이드바│  ③ 에디터 영역                          │
│ (TreeView)│     코드 작성하는 곳                     │
│          │     CodeLens(인라인 접근성 경고)도 여기   │
│ 디바이스  │                                          │
│ ├ ios-1  │                                          │
│ └ android│                                          │
│          │                                          │
│ 컴포넌트  ├──────────────────────────────────────────┤
│ ├ App    │                                          │
│ ├ Home   │  ④ 하단 패널 (Webview)                   │
│ └ Cart   │     Network / Console / State / Renders  │
│          │     Chrome DevTools 느낌의 탭 UI          │
│          │                                          │
└──────────┴──────────────────────────────────────────┘
```

### ① 상태바 — 연결 상태

하단에 한 줄 표시. 앱 연결/해제 실시간 반영.

```
🟢 RN MCP: ios-1 connected        (연결됨)
🔴 RN MCP: disconnected           (미연결)
```

클릭 → 연결된 디바이스 목록 표시.

**VS Code API**: `vscode.window.createStatusBarItem()`

### ② 사이드바 — 컴포넌트 트리

React DevTools의 Components 탭과 유사. fiber 트리를 트리뷰로 표시.

```
▼ App
  ▼ NavigationContainer
    ▼ HomeScreen
      ▼ ScrollView
        ├ ProductCard  #product-1
        ├ ProductCard  #product-2
        └ CartBadge    count: 3
```

- 클릭 → 해당 컴포넌트의 소스 파일로 점프
- 우클릭 → "Inspect State", "Highlight on Device"

**VS Code API**: `vscode.window.registerTreeDataProvider()`

### ③ 에디터 인라인 — 접근성 경고

코드 편집 중 접근성 문제를 인라인으로 표시.

```tsx
<Pressable onPress={handlePress}>
  {' '}
  // ⚠️ accessibilityLabel 없음
  <Image source={icon} /> // ⚠️ alt text 없음
</Pressable>
```

**VS Code API**: `vscode.languages.registerCodeLensProvider()` 또는 `Diagnostics`

### ④ 하단 패널 (Webview) — 메인 대시보드

웹페이지를 VS Code 안에 임베드. React로 만든 UI를 자유롭게 렌더.

```
┌─ Network ─┬─ Console ─┬─ State ─┬─ Renders ─┐
│                                               │
│  GET /api/products    200  120ms              │
│  POST /api/cart       201   85ms              │
│  GET /api/user        ❌ MOCKED → 200         │
│                                               │
│  [+ Add Mock Rule]  [Clear]                   │
└───────────────────────────────────────────────┘
```

| 탭          | 내용                             | 대응 MCP 도구                               |
| ----------- | -------------------------------- | ------------------------------------------- |
| **Network** | 요청 목록 + 모킹 룰 관리 GUI     | `list_network_requests`, `set_network_mock` |
| **Console** | 콘솔 로그 실시간 스트림          | `list_console_messages`                     |
| **State**   | 컴포넌트 Hook 상태 + 변경 이력   | `inspect_state`, `get_state_changes`        |
| **Renders** | 리렌더 핫스팟 + 불필요 렌더 표시 | `get_render_report`                         |

**VS Code API**: `vscode.window.createWebviewPanel()`

---

## 요소 인스펙터 (Element Inspector)

### 개요

시뮬레이터/에뮬레이터 화면 위에서 **마우스를 올리면 해당 React 컴포넌트가 하이라이트**되는 기능. macOS Accessibility API에 의존하지 않고, **마우스 좌표 + 창 위치 + fiber 좌표** 조합으로 구현하여 iOS 시뮬레이터와 Android 에뮬레이터 모두 지원한다.

### 왜 macOS Accessibility API를 쓰지 않는가

|                | iOS 시뮬레이터              | Android 에뮬레이터                 |
| -------------- | --------------------------- | ---------------------------------- |
| **macOS AX**   | ✓ UIKit 뷰가 AX 트리에 노출 | ✗ 화면 전체가 하나의 렌더링 서피스 |
| **fiber 기반** | ✓                           | ✓                                  |

Android 에뮬레이터는 QEMU 가상머신 위에 화면을 한 장의 이미지로 쏘는 구조라서, macOS AX에는 창 전체가 단일 이미지로 보인다. 또한 macOS AX로는 React 컴포넌트 이름, 상태, props 등을 알 수 없다.

반면 **마우스 좌표 + 창 위치 + fiber 좌표** 방식은 OS의 UI 트리에 의존하지 않으므로 **iOS/Android 모두 동작**한다.

### 동작 원리

```
① 마우스 절대좌표 (screenX, screenY)
                    ↓  빼기
② 시뮬레이터 창 위치 + 콘텐츠 오프셋 (winX, winY, titleBarH)
                    ↓  나누기
③ 스케일 팩터 (창 크기 / 앱 논리 해상도)
                    ↓  결과
④ 앱 내 상대좌표 (appX, appY)
                    ↓  히트 테스트
⑤ fiber 요소들의 measureView 좌표와 비교
                    ↓
⑥ "이 위치에 있는 컴포넌트는 ProductCard #product-1"
```

### 좌표 계산

```
relX = (screenX - winX - contentOffsetX) / scale
relY = (screenY - winY - contentOffsetY) / scale

scale = 시뮬레이터_콘텐츠_영역_너비 / Dimensions.get('window').width
```

**콘텐츠 오프셋**: 시뮬레이터 창의 타이틀바, 베젤 등 비콘텐츠 영역 높이.

```
시뮬레이터 창
┌──────────────────┐
│ 타이틀바 (28px)   │ ← contentOffsetY
├──────────────────┤
│                  │
│  앱 화면 영역     │ ← 실제 좌표 영역
│                  │
└──────────────────┘
```

**스케일 계산 예시**:

```
iPhone 16 시뮬레이터:
  - 앱 논리 해상도: 393 × 852 pt
  - 창 콘텐츠 영역: 295 × 639 px (축소 표시)
  - scale = 295 / 393 = 0.75
```

### 히트 테스트

앱 내 상대좌표 `(appX, appY)`를 구한 뒤, fiber 트리의 모든 요소 bounds와 비교:

```javascript
// 의사 코드
function hitTest(appX, appY, elements) {
  // 해당 좌표를 포함하는 요소들 필터
  const hits = elements.filter(
    (el) => appX >= el.x && appX <= el.x + el.width && appY >= el.y && appY <= el.y + el.height
  );

  // 가장 작은 (가장 구체적인) 요소 선택
  return hits.sort((a, b) => a.width * a.height - b.width * b.height)[0];
}
```

fiber 요소 좌표는 `take_snapshot` 또는 `query_selector_all`로 이미 가져올 수 있다.

### 사용자 플로우

```
1. VS Code에서 "RN MCP: Inspect Mode" 활성화 (단축키 Cmd+Shift+I)
2. 시뮬레이터/에뮬레이터 위에서 마우스 이동
3. 마우스 위치의 React 컴포넌트가 오버레이로 하이라이트:
   ┌─ ProductCard ─ #product-1 ─ 120×80 ─┐
   │                                       │
   │   [상품 이미지]  사과  ₩3,000         │
   │                                       │
   └───────────────────────────────────────┘
4. 클릭하면:
   → VS Code 사이드바에 해당 컴포넌트 상태/props 표시
   → 소스 파일로 점프 (가능한 경우)
```

### 크로스 플랫폼 지원

핵심: **마우스 좌표와 창 위치를 가져오는 부분만 OS별로 다르다.** fiber 좌표는 WebSocket으로 받으므로 OS 무관.

| 정보                | macOS                        | Windows                                | Linux                         |
| ------------------- | ---------------------------- | -------------------------------------- | ----------------------------- |
| 마우스 좌표         | `CGEvent`                    | `GetCursorPos` (Win32)                 | X11 `XQueryPointer` / Wayland |
| 창 위치/크기        | `CGWindowListCopyWindowInfo` | `FindWindow` + `GetWindowRect` (Win32) | `XGetWindowAttributes`        |
| **fiber 요소 좌표** | WebSocket (OS 무관)          | WebSocket (OS 무관)                    | WebSocket (OS 무관)           |

Windows의 Win32 API 예시:

```c
// 마우스 좌표
POINT pt;
GetCursorPos(&pt);

// 에뮬레이터 창 위치
HWND hwnd = FindWindow(NULL, "Android Emulator");
RECT rect;
GetWindowRect(hwnd, &rect);
```

**OS별 지원 가능 시뮬레이터/에뮬레이터**:

|                    | macOS | Windows           | Linux             |
| ------------------ | ----- | ----------------- | ----------------- |
| iOS 시뮬레이터     | ✓     | ✗ (존재하지 않음) | ✗ (존재하지 않음) |
| Android 에뮬레이터 | ✓     | ✓                 | ✓                 |

iOS 시뮬레이터가 macOS 전용인 것은 이 기능과 무관한 기존 제약.

### 오버레이 표시 방식

마우스 위치의 요소를 하이라이트하는 방법:

| 방식                     | 설명                                                    | 장단점                                       |
| ------------------------ | ------------------------------------------------------- | -------------------------------------------- |
| **투명 윈도우 오버레이** | 시뮬레이터 위에 투명 창을 띄워 박스 그림                | 시각적으로 깔끔. OS별 투명 창 API 필요       |
| **앱 내부 오버레이**     | runtime.js에서 React Native View로 하이라이트 박스 렌더 | 크로스 플랫폼. 앱 레이아웃에 영향 줄 수 있음 |
| **VS Code 패널 미러링**  | Webview 패널에 스크린샷 + 하이라이트 박스 합성 표시     | 별도 창 불필요. 실시간성 떨어짐              |

Phase 1에서는 **앱 내부 오버레이** (runtime.js에서 절대 위치 View 렌더)가 가장 구현이 간단하고 크로스 플랫폼.

---

## 패키지 구조

```
packages/
├── react-native-mcp-ui/        ← 공유 React UI (웹 컴포넌트)
│   ├── src/
│   │   ├── panels/
│   │   │   ├── NetworkInspector.tsx
│   │   │   ├── ConsoleViewer.tsx
│   │   │   ├── ComponentTree.tsx
│   │   │   ├── StateInspector.tsx
│   │   │   └── MockRuleEditor.tsx
│   │   ├── hooks/
│   │   │   └── useMcpConnection.ts     ← MCP 서버 통신 추상화
│   │   └── store/
│   │       └── mcp-store.ts            ← Zustand 상태 관리
│   └── package.json
│
├── react-native-mcp-vscode/    ← VS Code 확장 (thin shell)
│   ├── src/
│   │   ├── extension.ts               ← activate/deactivate
│   │   ├── webview-provider.ts         ← Webview에 mcp-ui 렌더
│   │   ├── inspector/
│   │   │   ├── window-tracker.ts       ← OS별 창 위치 추적
│   │   │   ├── hit-test.ts             ← 좌표 → 컴포넌트 매핑
│   │   │   └── overlay.ts             ← 하이라이트 오버레이
│   │   ├── tree-providers/
│   │   │   ├── DeviceTreeProvider.ts
│   │   │   └── ComponentTreeProvider.ts
│   │   └── commands.ts                 ← 팔레트 명령
│   └── package.json
```

### 레이어 분리

| 레이어     | 패키지              | 역할                       | 재사용 범위                            |
| ---------- | ------------------- | -------------------------- | -------------------------------------- |
| **데이터** | `mcp-server` (기존) | MCP 서버 통신, 도구 호출   | 모든 곳                                |
| **UI**     | `mcp-ui` (신규)     | React 컴포넌트 + 상태 관리 | VS Code webview, 웹 대시보드, Electron |
| **Shell**  | `mcp-vscode` (신규) | VS Code API 래핑만         | VS Code 전용                           |

`mcp-ui`를 별도 패키지로 분리하여 동일한 UI를 VS Code webview, 웹 대시보드, Electron 데스크탑 앱 등에서 재사용 가능.

---

## 통신 아키텍처

### 현재 (MCP 도구 호출)

```
AI 클라이언트 (Cursor/Claude)
  ↕ MCP 프로토콜 (stdio)
MCP 서버
  ↕ WebSocket (ws://localhost:12300)
React Native 앱 (runtime.js)
```

### VS Code 확장 추가 시

```
VS Code Extension
  ├── Webview (mcp-ui)
  │     ↕ postMessage (VS Code 내부)
  ├── Extension Host
  │     ↕ WebSocket (ws://localhost:12300) — 직접 연결
  └── MCP 서버와 공존 가능 (같은 포트, 별도 클라이언트)

React Native 앱 (runtime.js)
```

Extension Host가 MCP 서버의 WebSocket에 직접 연결하거나, MCP 서버를 경유하여 앱 런타임과 통신.

### 실시간 데이터

현재 MCP는 poll 방식 (도구 호출 → 결과 반환). VS Code 패널의 실시간 모니터링에는:

| 방식                    | 설명                                            | 장단점                                      |
| ----------------------- | ----------------------------------------------- | ------------------------------------------- |
| **Polling**             | 1초 간격으로 `list_network_requests` 등 호출    | 구현 간단, 비효율적                         |
| **WebSocket subscribe** | Extension이 12300 포트에 직접 연결, 이벤트 push | 효율적, 서버에 subscribe 프로토콜 추가 필요 |

Phase 1에서는 polling, 이후 subscribe 프로토콜 추가.

---

## 구현 Phase

### Phase 1 — 최소 동작 (★★☆)

- 상태바 연결 표시
- Webview 패널: Network + Console 탭
- Polling 방식 데이터 갱신

**결과**: "앱 네트워크와 콘솔을 VS Code에서 본다"

### Phase 2 — 컴포넌트 탐색 (★★☆)

- 사이드바 컴포넌트 트리 (TreeView)
- 트리 항목 클릭 → 소스 파일 점프
- 요소 인스펙터 기초 (좌표 계산 + 히트 테스트)

**결과**: "컴포넌트를 클릭하면 해당 파일로 이동"

### Phase 3 — 인스펙터 + 상태 (★★★)

- 요소 인스펙터 오버레이 (마우스 호버 → 하이라이트)
- OS별 창 위치 추적 (macOS/Windows/Linux)
- State Inspector + Mock Rule Editor GUI
- Webview 패널: State + Renders 탭 추가

**결과**: "시뮬레이터에서 마우스로 요소를 지정하고 상태를 본다"

### Phase 4 — 에디터 통합 (★★☆)

- 접근성 감사 인라인 경고 (CodeLens / Diagnostics)
- WebSocket subscribe 프로토콜 (실시간 push)
- testID가 있는 컴포넌트 파일 데코레이션

**결과**: "코드 편집 중 a11y 문제가 보이고, 데이터가 실시간으로 갱신된다"

---

## 요소 인스펙터 — 구현 세부 사항

### 필요한 native 헬퍼

마우스 좌표 + 창 위치를 가져오는 건 Node.js 순수 API로는 불가능. 선택지:

| 방식                          | 설명                                             | 장단점                          |
| ----------------------------- | ------------------------------------------------ | ------------------------------- |
| **Node native addon** (N-API) | C/C++로 OS API 호출                              | 빌드 필요, prebuild 배포 가능   |
| **Swift/Rust CLI 헬퍼**       | 작은 바이너리, extension에서 spawn               | OS별 바이너리 번들링            |
| **Electron API 활용**         | VS Code가 Electron이므로 `screen` 모듈 접근 시도 | VS Code가 허용하지 않을 수 있음 |
| **child_process + OS 유틸**   | macOS: `osascript`, Windows: PowerShell          | 느리지만 빌드 불필요            |

추천: **Phase 2에서는 child_process + OS 유틸** (프로토타입), **Phase 3에서 native addon으로 전환** (성능).

### macOS — osascript로 프로토타입 가능

```bash
# 마우스 좌표
osascript -e 'tell application "System Events" to get position of mouse'

# 시뮬레이터 창 위치
osascript -e 'tell application "System Events" to tell process "Simulator" to get position of window 1'
osascript -e 'tell application "System Events" to tell process "Simulator" to get size of window 1'
```

### Windows — PowerShell로 프로토타입 가능

```powershell
# 마우스 좌표
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.Cursor]::Position

# 창 위치 (Win32 P/Invoke)
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class Win32 {
    [DllImport("user32.dll")]
    public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll")]
    public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);
    public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
```

### 스케일 팩터 계산

```
scale = 시뮬레이터_콘텐츠_영역_너비 / Dimensions.get('window').width
```

`Dimensions.get('window')`는 앱 런타임에서 `evaluate_script`로 이미 가져올 수 있다:

```javascript
// evaluate_script로 호출
() => {
  const { width, height } = require('react-native').Dimensions.get('window');
  return { width, height };
};
```

### 시뮬레이터 창 식별

여러 시뮬레이터/에뮬레이터가 열려 있을 수 있으므로, 올바른 창을 찾아야 한다:

- **iOS**: 창 제목에 디바이스 이름 포함 (예: "iPhone 16 — MyApp")
- **Android**: 창 제목에 에뮬레이터 이름 포함 (예: "Android Emulator - Pixel_7:5554")
- MCP 연결 시 디바이스 정보를 이미 알고 있으므로 매칭 가능

---

## 경쟁 도구 비교

| 기능                       | react-native-mcp (계획) | React DevTools | Flipper (deprecated) | Reactotron  |
| -------------------------- | ----------------------- | -------------- | -------------------- | ----------- |
| 컴포넌트 트리              | ✓ (fiber 기반)          | ✓              | ✓                    | ✓           |
| Hook 상태 인스펙션         | ✓                       | ✓              | △                    | △           |
| 네트워크 모니터            | ✓ + 모킹 GUI            | ✗              | ✓                    | ✓           |
| 콘솔 로그                  | ✓                       | ✗              | ✓                    | ✓           |
| 리렌더 프로파일링          | ✓ (trigger 분석)        | ✓ (Profiler)   | ✗                    | ✗           |
| **요소 인스펙터 (마우스)** | ✓ (계획)                | ✓ (브라우저)   | ✗                    | ✗           |
| **접근성 감사 인라인**     | ✓ (계획)                | ✗              | ✗                    | ✗           |
| **AI 연동**                | ✓ (MCP)                 | ✗              | ✗                    | ✗           |
| VS Code 통합               | ✓ (네이티브)            | △ (별도 창)    | △ (별도 앱)          | △ (별도 앱) |
| 유지 보수 상태             | 활발                    | 활발           | deprecated           | 활발        |

---

## 참고 자료

- [xray](https://github.com/wlswo/xray) — macOS AX 기반 UI 인스펙터 (Tauri). 요소 인스펙터 UX 참고
- [VS Code Extension API](https://code.visualstudio.com/api) — TreeView, Webview, StatusBar, CodeLens 등
- [React DevTools](https://github.com/facebook/react/tree/main/packages/react-devtools) — 컴포넌트 트리 + Profiler 참고
- macOS `CGWindowListCopyWindowInfo` — 창 위치/크기 조회
- Win32 `GetWindowRect` / `FindWindow` — Windows 창 위치 조회
