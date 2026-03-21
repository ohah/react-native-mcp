# rn-mcp CLI (Snapshot + Refs)

AI 에이전트가 셸에서 직접 React Native 앱을 제어하는 CLI 인터페이스입니다.
[agent-browser](https://github.com/vercel-labs/agent-browser)의 **Snapshot + Refs** 패턴을 적용하여 토큰 효율적인 상호작용을 지원합니다.

## 왜 CLI인가?

| | MCP 도구 | rn-mcp CLI |
|---|---|---|
| **토큰 비용** | 높음 — 매 호출마다 전체 JSON 응답 | 낮음 — compact refs (`@e1`, `@e2`) |
| **탭 단계** | query_selector → 좌표 추출 → tap (3회) | `rn-mcp tap @e3` (1회) |
| **설정** | MCP 클라이언트 설정 필요 | 셸 명령, 설정 불필요 |
| **적합 대상** | Cursor, Windsurf (MCP 전용 에디터) | Claude Code, Codex, 셸 스크립트 |

## 설치

CLI는 같은 패키지에 포함되어 있습니다:

```bash
# 글로벌 설치
npm install -g @ohah/react-native-mcp-server

# 또는 npx
npx rn-mcp --help

# 또는 프로젝트 로컬
npm install -D @ohah/react-native-mcp-server
npx rn-mcp --help
```

## 전제 조건

- MCP 서버가 실행 중이어야 합니다 (에디터가 시작하거나 `npx react-native-mcp-server`)
- 앱이 시뮬레이터/에뮬레이터에서 실행 중이고 WebSocket(포트 12300)으로 연결되어야 합니다
- iOS: [idb](https://fbidb.io/) 설치 필요
- Android: [adb](https://developer.android.com/tools/adb) 설치 필요

## 워크플로우

```bash
# 1. 연결 확인
rn-mcp status

# 2. interactive 요소를 @ref로 조회
rn-mcp snapshot -i

# 3. @ref로 요소 조작
rn-mcp tap @e3
rn-mcp type @e5 "user@example.com"

# 4. 화면 전환 후 refs 갱신
rn-mcp snapshot -i
```

### Snapshot 출력 예시

```
@e1   View #login-screen
@e2     TextInput #email "이메일"
@e3     TextInput #password "비밀번호"
@e4     Pressable #login-btn "로그인"
@e5     Pressable #signup-link "회원가입"
```

각 요소에 `@e1`, `@e2`, ... 순번이 depth-first 순회로 부여됩니다.

## 명령어

### 연결

| 명령 | 설명 |
|------|------|
| `rn-mcp status` | 연결 상태 및 디바이스 목록 |

### Snapshot

| 명령 | 설명 |
|------|------|
| `rn-mcp snapshot` | 전체 컴포넌트 트리 + @refs |
| `rn-mcp snapshot -i` | interactive 요소만 (권장) |
| `rn-mcp snapshot --max-depth 10` | 트리 깊이 제한 (기본: 30) |
| `rn-mcp snapshot -i --json` | 스크립팅용 JSON 출력 |

### 상호작용

| 명령 | 설명 |
|------|------|
| `rn-mcp tap @e3` | ref로 탭 |
| `rn-mcp tap "#login-btn"` | 셀렉터로 탭 |
| `rn-mcp tap @e3 --long 500` | 롱프레스 (500ms) |
| `rn-mcp type @e5 "텍스트"` | TextInput에 입력 |
| `rn-mcp swipe @e2 down` | 스와이프 |
| `rn-mcp swipe @e2 down --dist 300` | 거리 지정 스와이프 (dp) |
| `rn-mcp key back` | 하드웨어 키 입력 |

사용 가능한 키: `back`, `home`, `enter`, `tab`, `delete`, `up`, `down`, `left`, `right`

### 검증 (Assert)

| 명령 | 설명 |
|------|------|
| `rn-mcp assert text "환영합니다"` | 텍스트 존재 확인 (exit 0/1) |
| `rn-mcp assert visible @e3` | 요소 가시성 확인 |
| `rn-mcp assert not-visible @e3` | 요소 비가시성 확인 |
| `rn-mcp assert count "Pressable" 5` | 요소 개수 확인 |

### 조회 (Query)

| 명령 | 설명 |
|------|------|
| `rn-mcp query "#my-btn"` | 단일 요소 정보 조회 |
| `rn-mcp query --all "Pressable"` | 매칭되는 모든 요소 조회 |

### 스크린샷

| 명령 | 설명 |
|------|------|
| `rn-mcp screenshot` | 스크린샷 저장 (기본: screenshot.png) |
| `rn-mcp screenshot -o login.png` | 파일명 지정 |

### AI 에이전트 가이드 설정

| 명령 | 설명 |
|------|------|
| `rn-mcp init-agent` | AGENTS.md + CLAUDE.md에 CLI 가이드 추가 |
| `rn-mcp init-agent --lang ko` | 한국어 가이드 |
| `rn-mcp init-agent --target claude` | CLAUDE.md에만 추가 |

## 전역 옵션

```
-d, --device <id>        대상 디바이스 (다중 연결 시)
-p, --platform <os>      ios 또는 android
--port <n>               WebSocket 포트 (기본: 12300)
--json                   스크립팅용 JSON 출력
--timeout <ms>           명령 타임아웃 (기본: 10000)
-h, --help               도움말
-v, --version            버전 정보
```

## Refs 시스템

### 동작 방식

1. `rn-mcp snapshot -i`가 각 요소에 `@e1`, `@e2`, ... 할당 (depth-first 순회)
2. Refs가 `~/.rn-mcp/session.json`에 저장됨
3. 이후 명령에서 refs 사용: `rn-mcp tap @e3`
4. snapshot을 다시 실행하면 **이전 refs 전부 무효화**

### 언제 re-snapshot 해야 하나

- 화면 전환 후 (네비게이션, 모달 열기/닫기)
- `@ref not found` 에러 발생 시
- UI 구조가 변경되는 액션 후

### 셀렉터 (refs 대안)

snapshot 없이 셀렉터를 직접 사용할 수도 있습니다:

```bash
rn-mcp tap "#login-btn"                    # testID로
rn-mcp tap "Pressable:text(\"로그인\")"     # type + text로
rn-mcp tap "TextInput[placeholder=\"이메일\"]"  # 속성으로
```

## 주의사항

- **iOS orientation**은 자동 처리됩니다 — 별도 조치 불필요
- **Android dp→px 변환**도 자동입니다
- **좌표는 points(dp)** 단위, 픽셀이 아닙니다
- `--json` 플래그로 프로그래밍 방식의 출력 파싱 가능

## 예시: 로그인 플로우

```bash
# 연결 확인
rn-mcp status

# 화면 요소 확인
rn-mcp snapshot -i
# @e1   TextInput #email "이메일"
# @e2   TextInput #password "비밀번호"
# @e3   Pressable #login-btn "로그인"

# 폼 입력 및 제출
rn-mcp type @e1 "test@example.com"
rn-mcp type @e2 "password123"
rn-mcp tap @e3

# 네비게이션 확인
rn-mcp assert text "대시보드"

# 새 화면 요소 확인
rn-mcp snapshot -i
```
