# VS Code 확장 (DevTools)

React Native MCP DevTools는 MCP 서버에 연결하여 Chrome DevTools와 유사한 GUI를 VS Code 안에서 제공합니다.

## 기능

### Console

앱의 콘솔 로그를 실시간으로 모니터링합니다.

- level 필터 (log, info, warn, error)
- 텍스트 검색
- 자동 폴링 (Pause/Resume)

### Network

XHR/fetch 요청을 Chrome DevTools Network 탭과 유사한 스타일로 표시합니다.

- 요청 목록: 상태 코드 (색상 배지), 메서드, URL, 응답 시간
- 상세 패널 (드래그로 높이 조절 가능): Headers / Request / Response 서브탭
- `responseHeaders` JSON 자동 파싱
- Mock된 요청에 배지 표시

### State

useState/useReducer/Zustand 등의 상태 변경 이력을 추적합니다.

- **Grouped 뷰 (기본)**: 컴포넌트별 그룹화, 변경 횟수 배지, 타임라인 border
  - 프리미티브 변경은 인라인으로 즉시 표시 (`3 → 5`, `"hello" → "world"`)
  - 객체/배열 변경은 클릭하여 unified diff 확인
- **Timeline 뷰**: 시간순 전체 이력
- **Unified diff**: 변경된 키만 빨강(-)/초록(+) 강조, 변경 없는 키는 dim 처리
- 컴포넌트 필터

### Renders

렌더 프로파일링으로 불필요한 리렌더링을 감지합니다.

- Start/Stop 프로파일링, 실시간 Refresh
- Hot component 목록: 렌더 횟수, 불필요 렌더, memo 여부
- **빌트인 컴포넌트 구분**: `Text`, `View`, `Pressable` 등은 가장 가까운 사용자 컴포넌트로 구분하여 표시
  - 예: `MyHeader > Text`, `CartItem > Pressable` (같은 `Text`여도 위치별로 분리)
- **nativeType 배지**: 커스텀 컴포넌트가 렌더하는 네이티브 요소 표시 (예: `MyButton` → `Pressable`)
- Trigger 분석: state / props / context / parent 별 분류 및 배지
- **Parent 점프 네비게이션**: Recent Renders에서 parent 이름 클릭 시 해당 컴포넌트로 스크롤 + 하이라이트
- Prop/State/Context 변경 diff 뷰어
- `trigger: parent` + 변경 없음 → "React.memo로 방지 가능" 힌트 표시

### 기타

- **Component Tree** — 사이드바에서 앱의 React 컴포넌트 트리 탐색
- **Accessibility Audit** — 접근성 위반 항목을 에디터 인라인 경고로 표시
- **Activity Bar** — 사이드바에서 DevTools를 상시 확인 가능
- **연결 관리** — 연결 끊김 시 빨간 배너 + Reconnect 버튼, 모든 패널 데이터 자동 초기화
- **디바이스 표시** — 실제 연결된 디바이스 정보 표시 (멀티 디바이스 시 선택 가능)

## 설치

### 마켓플레이스에서 설치

> 아직 마켓플레이스에 배포 전이라면 아래 로컬 설치 방법을 사용하세요.

VS Code에서 `Ctrl+Shift+X` → `React Native MCP DevTools` 검색 → 설치.

### .vsix 파일로 로컬 설치

```bash
cd editor/vscode
bun install
bun run package   # react-native-mcp-devtools-x.x.x.vsix 생성
```

생성된 `.vsix` 파일을 VS Code에서 설치:

```bash
code --install-extension react-native-mcp-devtools-0.1.0.vsix
```

또는 VS Code → Extensions → `...` 메뉴 → `Install from VSIX...` 선택.

## 사용법

### 1. MCP 서버 실행

확장은 `ws://localhost:12300`으로 MCP 서버에 연결합니다. 먼저 MCP 서버와 앱을 실행하세요:

```bash
# MCP 서버 실행
npx @ohah/react-native-mcp-server

# 앱 실행 (별도 터미널)
cd your-rn-project && npx react-native start
```

### 2. 자동 연결

확장이 활성화되면 자동으로 MCP 서버에 연결을 시도합니다. 하단 상태바에서 연결 상태를 확인할 수 있습니다:

- `$(circle-filled) React Native MCP — ios:iPhone 16` — 연결됨 (디바이스 표시)
- `$(circle-outline) React Native MCP` — 미연결 (빨간 배경)

미연결 시 DevTools 패널 상단에 빨간 배너와 **Reconnect** 버튼이 표시됩니다. 연결이 끊기면 모든 패널의 데이터가 자동으로 초기화되어 이전 세션의 오래된 데이터가 표시되지 않습니다.

### 3. DevTools 열기

두 가지 방법으로 열 수 있습니다:

- **Activity Bar (사이드바)**: 왼쪽 Activity Bar에서 React Native MCP 아이콘 클릭 → DevTools 패널 + Component Tree가 사이드바에 표시
- **에디터 탭**: `Ctrl+Shift+P` → `React Native MCP: Open DevTools` → 별도 에디터 탭에 열림

### 4. 명령어

| 명령                                        | 설명                                |
| ------------------------------------------- | ----------------------------------- |
| `React Native MCP: Open DevTools`           | 에디터 탭에 DevTools 열기           |
| `React Native MCP: Refresh Component Tree`  | 사이드바 컴포넌트 트리 새로고침     |
| `React Native MCP: Run Accessibility Audit` | 접근성 감사 실행 (인라인 경고 표시) |

## 설정

`settings.json`에서 설정할 수 있습니다:

```json
{
  "reactNativeMcp.port": 12300,
  "reactNativeMcp.autoConnect": true
}
```

| 설정                         | 기본값  | 설명                      |
| ---------------------------- | ------- | ------------------------- |
| `reactNativeMcp.port`        | `12300` | MCP 서버 WebSocket 포트   |
| `reactNativeMcp.autoConnect` | `true`  | VS Code 시작 시 자동 연결 |

## 개발

### 빌드

```bash
cd editor/vscode
bun install
bun run build    # dist/extension.js + dist/webview.js 생성
bun run watch    # 파일 변경 시 자동 재빌드
```

### 디버깅 (Extension Development Host)

1. VS Code에서 `editor/vscode` 폴더 열기
2. `F5` → Extension Development Host 실행
3. 새 VS Code 창에서 확장이 로드됨

### 아키텍처

```
VS Code Extension ──ws://localhost:12300──▶ MCP Server ──eval──▶ RN App
Cursor/Claude ────────stdio────────────────▶ (동일 서버)
```

확장은 MCP 서버의 WebSocket에 `extension-init` 타입으로 연결합니다. 기존 MCP stdio 클라이언트(Cursor 등)와 동시에 사용 가능합니다.
