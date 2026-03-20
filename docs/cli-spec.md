# react-native-mcp CLI Spec (Snapshot + Refs)

## 개요

기존 MCP 프로토콜은 유지하면서, AI 에이전트가 셸에서 직접 호출할 수 있는 CLI 인터페이스를 추가한다.
agent-browser의 Snapshot+Refs 패턴을 React Native Fiber 트리에 적용.

## 아키텍처

```
┌─────────┐     ┌──────────────────────┐     ┌─────────────┐
│  AI     │────▶│  rn-mcp (CLI)        │────▶│  RN App     │
│  Agent  │ sh  │  (경량 클라이언트)      │ WS  │  (runtime)  │
└─────────┘     └──────────────────────┘     └─────────────┘
                         │
                         ▼
                  ~/.rn-mcp/session.json  ← refs 매핑 저장
```

### 통신 구조

- CLI → WebSocket 서버(포트 12300)에 직접 연결 (기존 AppSession 재사용)
- MCP 서버를 경유하지 않음 — CLI는 독립 프로세스
- 세션 파일(`~/.rn-mcp/session.json`)에 refs 매핑 저장 → CLI 호출 간 상태 공유

## 명령어

### 연결 & 상태

```bash
rn-mcp status                    # 연결 상태, 디바이스 목록
rn-mcp devices                   # 연결된 디바이스 목록 (deviceId, platform)
```

### Snapshot (핵심)

```bash
rn-mcp snapshot                  # 전체 컴포넌트 트리 + refs 할당
rn-mcp snapshot -i               # interactive 요소만 (Pressable, Button, TextInput 등)
rn-mcp snapshot --max-depth 10   # 깊이 제한
```

**출력 예시:**
```
@e1  View #main-container
@e2    ScrollView #feed
@e3      Pressable #post-1 "첫 번째 게시글"
@e4      Pressable #post-2 "두 번째 게시글"
@e5    TextInput #search "검색..."
@e6    Pressable #settings-btn "설정"
```

- 각 요소에 `@e1`, `@e2`, ... 순번 부여 (depth-first 순회)
- refs는 `~/.rn-mcp/session.json`에 저장 → 이후 명령에서 사용
- `-i` 플래그: interactive 요소만 필터 → 토큰 대폭 절감

### 상호작용

```bash
rn-mcp tap @e3                   # ref로 탭 (내부: uid → 좌표 조회 → idb/adb tap)
rn-mcp tap @e3 --long 500        # 롱프레스 (500ms)
rn-mcp type @e5 "검색어"          # ref의 TextInput에 텍스트 입력
rn-mcp clear @e5                 # ref의 TextInput 텍스트 삭제
rn-mcp swipe @e2 down            # ref 요소 기준 스와이프
rn-mcp swipe @e2 down --dist 300 # 거리 지정
rn-mcp scroll @e2 until @e10     # @e2 내에서 @e10이 보일 때까지 스크롤
rn-mcp key back                  # 하드웨어 버튼 (back, home, enter)
```

### 검증 (assert)

```bash
rn-mcp assert text "환영합니다"           # 화면에 텍스트 존재 확인
rn-mcp assert visible @e3                # 요소 가시성 확인
rn-mcp assert not-visible @e3            # 요소 비가시성 확인
rn-mcp assert count "Pressable" 5        # 셀렉터 매칭 개수 확인
```

- exit code 0 = pass, 1 = fail
- stdout에 pass/fail 메시지

### 셀렉터 직접 사용

refs 대신 기존 셀렉터도 지원 (snapshot 없이 바로 사용 가능):

```bash
rn-mcp tap "#login-btn"          # testID로 탭
rn-mcp tap "Pressable:text(\"로그인\")"  # 셀렉터로 탭
rn-mcp query "#login-btn"        # 요소 정보 조회 (좌표, uid 등)
rn-mcp query-all "Pressable"     # 매칭되는 모든 요소
```

### 스크린샷 & 미디어

```bash
rn-mcp screenshot                # stdout에 base64 또는 파일 저장
rn-mcp screenshot -o login.png   # 파일로 저장
rn-mcp record start -o test.mp4  # 녹화 시작
rn-mcp record stop               # 녹화 종료
```

### WebView

```bash
rn-mcp webview list              # 등록된 WebView ID 목록
rn-mcp webview eval <id> "document.querySelector('button').click()"
rn-mcp webview eval <id> "document.querySelector('input').value"
```

### 디바이스 제어

```bash
rn-mcp orientation               # 현재 방향
rn-mcp orientation landscape     # 방향 변경
rn-mcp deeplink "myapp://profile/123"
rn-mcp location 37.5665 126.9780  # GPS 설정 (시뮬/에뮬)
```

### 디버깅

```bash
rn-mcp console                   # 콘솔 로그
rn-mcp console --level error     # 에러만
rn-mcp network                   # 네트워크 요청 목록
rn-mcp eval "() => global.myVar" # 앱 컨텍스트에서 JS 실행
```

## 전역 옵션

```bash
--device, -d <id>      # 디바이스 지정 (다중 연결 시)
--platform, -p <os>    # ios | android
--json                 # JSON 출력 (스크립팅용)
--port <n>             # WebSocket 포트 (기본 12300)
--timeout <ms>         # 명령 타임아웃 (기본 10000)
```

## Refs 생명주기

```
snapshot → refs 생성 (@e1, @e2, ...)
  ↓
tap @e3 → 성공 (refs 유효)
  ↓
tap @e3 → "✗ @e3 not found — run `rn-mcp snapshot` to refresh"
  ↓
snapshot → 새 refs 생성 (이전 refs 전부 무효화)
```

### 규칙

1. `snapshot` 호출 시 **이전 refs 전부 무효화**, 새 refs 생성
2. ref가 가리키는 요소가 화면에 없으면 에러 반환 + exit code 1
3. AI가 화면 전환을 예상하면 직접 `snapshot` 재호출
4. refs는 세션 파일에 저장 → CLI 호출 간 공유

### 세션 파일 구조

```json
{
  "port": 12300,
  "deviceId": "ios-1",
  "platform": "ios",
  "refs": {
    "@e1": { "uid": "main-container", "type": "View", "testID": "main-container" },
    "@e2": { "uid": "1.0.1", "type": "ScrollView", "testID": "feed" },
    "@e3": { "uid": "1.0.1.0", "type": "Pressable", "testID": "post-1", "text": "첫 번째 게시글" }
  },
  "updatedAt": "2026-03-21T10:30:00Z"
}
```

## ref → 좌표 변환 흐름

```
rn-mcp tap @e3
  ↓
1. session.json에서 @e3 → uid="1.0.1.0" 조회
2. WebSocket으로 querySelectorWithMeasure(uid) 호출
3. { pageX, pageY, width, height } 응답
4. 중심 좌표 계산: (pageX + width/2, pageY + height/2)
5. idb ui tap / adb shell input tap 실행
6. stdout: "✓ tapped @e3 Pressable #post-1"
```

- ref에 좌표를 캐싱하지 않음 — 매번 measure 호출
- 화면 전환/스크롤 후에도 uid가 유효하면 새 좌표로 탭 가능

## 구현 계획

### Phase 1: 핵심 (MVP)
- `rn-mcp snapshot [-i]` — Fiber 트리 + refs 할당
- `rn-mcp tap @ref` — ref로 탭
- `rn-mcp type @ref "text"` — ref로 텍스트 입력
- `rn-mcp assert text "..."` — 텍스트 존재 확인
- `rn-mcp status` — 연결 상태
- 세션 파일 관리

### Phase 2: 상호작용 확장
- `rn-mcp swipe`, `rn-mcp scroll`, `rn-mcp key`
- `rn-mcp screenshot`, `rn-mcp record`
- `rn-mcp query`, `rn-mcp query-all` (셀렉터 직접 사용)
- `--json` 출력 모드

### Phase 3: 디버깅 & WebView
- `rn-mcp console`, `rn-mcp network`
- `rn-mcp webview eval`
- `rn-mcp eval`
- `rn-mcp orientation`, `rn-mcp deeplink`, `rn-mcp location`

## AI 에이전트 연동 방식

### CLAUDE.md / AGENTS.md에 명시

```markdown
## React Native App Control

이 프로젝트의 React Native 앱을 제어하려면 `rn-mcp` CLI를 사용하세요.

### 기본 워크플로우
1. `rn-mcp status` — 앱 연결 확인
2. `rn-mcp snapshot -i` — 화면의 interactive 요소를 @ref로 조회
3. `rn-mcp tap @e3` — ref로 요소 탭
4. 화면이 바뀌었으면 `rn-mcp snapshot -i`로 새 refs 획득

### 규칙
- 스크린샷보다 `snapshot -i`와 `assert text`를 우선 사용 (토큰 절약)
- tap/type 후 화면 전환이 예상되면 반드시 `snapshot -i` 재호출
- ref가 "not found"이면 `snapshot -i`로 갱신
- WebView 내부 요소는 `rn-mcp webview eval`로 조작
```

### MCP와 CLI 공존

| 연동 방식 | 사용 도구 | 대상 |
|-----------|-----------|------|
| MCP 서버 | Cursor, Windsurf 등 에디터 | MCP 프로토콜 지원 클라이언트 |
| CLI | Claude Code, Codex, 셸 스크립트 | 셸 접근 가능한 AI 에이전트 |

동일한 WebSocket 서버(포트 12300)에 연결하므로 동시 사용 가능.
단, refs는 CLI 세션에서만 관리 — MCP 쪽에서는 기존 query_selector 방식 유지.

## bin 필드

```json
{
  "bin": {
    "react-native-mcp-server": "dist/index.js",
    "rn-mcp": "dist/cli.js"
  }
}
```

별도 entry point `src/cli.ts`로 분리. 기존 `src/index.ts`(MCP 서버)는 변경 없음.
