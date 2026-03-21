/**
 * rn-mcp init-agent 명령용 가이드 텍스트.
 * AGENTS.md / CLAUDE.md에 삽입할 CLI 사용 가이드.
 */

const MARKER_START = '<!-- rn-mcp-cli-guide:start -->';
const MARKER_END = '<!-- rn-mcp-cli-guide:end -->';

export { MARKER_START, MARKER_END };

export const GUIDE_EN = `${MARKER_START}
## rn-mcp CLI — React Native App Control

Use the \`rn-mcp\` CLI to control the React Native app from the shell.
It uses a Snapshot + Refs pattern for token-efficient interaction.

### Required Workflow

\`\`\`bash
# 1. Check connection
rn-mcp status

# 2. Get interactive elements as @refs
rn-mcp snapshot -i

# 3. Interact using @refs
rn-mcp tap @e3
rn-mcp type @e5 "user@example.com"

# 4. After screen transition, refresh refs
rn-mcp snapshot -i
\`\`\`

### Rules

1. **Always run \`snapshot -i\` first** before interacting with the app
2. **Re-run \`snapshot -i\` after screen transitions** — old refs become invalid
3. **\`@ref not found\` means refs are stale** — run \`snapshot -i\` to refresh
4. **Prefer \`assert text\` over screenshots** — much lower token cost
5. **iOS orientation is handled automatically** — no manual action needed

### Command Reference

| Command | Description |
|---------|-------------|
| \`rn-mcp status\` | Check connection status |
| \`rn-mcp snapshot -i\` | List interactive elements with @refs |
| \`rn-mcp tap @e3\` | Tap element |
| \`rn-mcp tap @e3 --long 500\` | Long press (500ms) |
| \`rn-mcp type @e5 "text"\` | Type into TextInput |
| \`rn-mcp swipe @e2 down\` | Swipe element |
| \`rn-mcp key back\` | Press hardware key (back, home, enter) |
| \`rn-mcp assert text "Welcome"\` | Verify text on screen (exit 0/1) |
| \`rn-mcp assert visible @e3\` | Verify element visibility |
| \`rn-mcp query "#btn"\` | Query element info |
| \`rn-mcp screenshot -o s.png\` | Save screenshot |

### Selectors (alternative to @refs)

\`\`\`bash
rn-mcp tap "#login-btn"              # by testID
rn-mcp tap "Pressable:text(\\"Go\\")"  # by type + text
\`\`\`

Run \`rn-mcp --help\` for full documentation.
${MARKER_END}`;

export const GUIDE_KO = `${MARKER_START}
## rn-mcp CLI — React Native 앱 제어

\`rn-mcp\` CLI로 셸에서 React Native 앱을 제어할 수 있습니다.
Snapshot + Refs 패턴으로 토큰 효율적인 상호작용을 지원합니다.

### 필수 워크플로우

\`\`\`bash
# 1. 연결 확인
rn-mcp status

# 2. interactive 요소를 @ref로 조회
rn-mcp snapshot -i

# 3. @ref로 요소 조작
rn-mcp tap @e3
rn-mcp type @e5 "user@example.com"

# 4. 화면 전환 후 refs 갱신
rn-mcp snapshot -i
\`\`\`

### 규칙

1. **반드시 \`snapshot -i\`부터** — 화면을 모르는 상태에서 tap하지 마세요
2. **화면 전환 후 \`snapshot -i\` 재호출** — 기존 refs는 무효화됩니다
3. **\`@ref not found\` = refs 갱신 필요** — \`snapshot -i\`를 다시 실행하세요
4. **스크린샷보다 \`assert text\`** — 토큰 비용이 훨씬 낮습니다
5. **iOS orientation 자동 처리** — 별도 조치 불필요

### 명령어 참조

| 명령 | 설명 |
|------|------|
| \`rn-mcp status\` | 연결 상태 확인 |
| \`rn-mcp snapshot -i\` | interactive 요소 + @ref 할당 |
| \`rn-mcp tap @e3\` | 요소 탭 |
| \`rn-mcp tap @e3 --long 500\` | 롱프레스 (500ms) |
| \`rn-mcp type @e5 "텍스트"\` | TextInput에 텍스트 입력 |
| \`rn-mcp swipe @e2 down\` | 스와이프 |
| \`rn-mcp key back\` | 하드웨어 키 (back, home, enter) |
| \`rn-mcp assert text "환영합니다"\` | 텍스트 존재 확인 (exit 0/1) |
| \`rn-mcp assert visible @e3\` | 요소 가시성 확인 |
| \`rn-mcp query "#btn"\` | 요소 정보 조회 |
| \`rn-mcp screenshot -o s.png\` | 스크린샷 저장 |

### 셀렉터 (@ref 대안)

\`\`\`bash
rn-mcp tap "#login-btn"              # testID로
rn-mcp tap "Pressable:text(\\"이동\\")"  # type + text로
\`\`\`

전체 문서: \`rn-mcp --help\`
${MARKER_END}`;
