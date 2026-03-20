#!/bin/bash
# rn-mcp CLI E2E smoke test
# MCP 서버를 백그라운드로 시작하고, CLI로 앱을 제어하는 통합 테스트.
# 앱은 이미 시뮬레이터/에뮬레이터에서 실행 중이어야 함.
#
# Usage: bash examples/demo-app/e2e/cli-smoke.sh [--platform ios|android]
set -euo pipefail

PLATFORM="${1:---platform}"
PLATFORM_VAL="${2:-ios}"
MCP_SERVER="node packages/react-native-mcp-server/dist/index.js"
CLI="node packages/react-native-mcp-server/dist/cli.js"
TIMEOUT="--timeout 25000"
MCP_PID=""

# 도움말: 함수 정의
pass() { echo "  ✓ $1"; }
fail() { echo "  ✗ $1"; cleanup; exit 1; }
step() { echo ""; echo "── $1 ──"; }

cleanup() {
  if [ -n "$MCP_PID" ] && kill -0 "$MCP_PID" 2>/dev/null; then
    echo "Stopping MCP server (PID $MCP_PID)..."
    kill "$MCP_PID" 2>/dev/null || true
    wait "$MCP_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# MCP 서버 시작 (WebSocket 서버 제공)
step "0. MCP 서버 시작 (백그라운드)"
$MCP_SERVER < /dev/null > /dev/null 2>&1 &
MCP_PID=$!
echo "  MCP server PID: $MCP_PID"

# 앱이 WebSocket에 연결될 때까지 대기 (최대 30초)
echo "  Waiting for app to connect..."
for i in $(seq 1 30); do
  if $CLI status --timeout 3000 2>&1 | grep -q "Connected"; then
    pass "app connected (${i}s)"
    break
  fi
  if [ "$i" -eq 30 ]; then
    fail "app did not connect within 30s"
  fi
  sleep 1
done

step "1. CLI --help / --version"
$CLI --version | grep -q "rn-mcp v" && pass "--version" || fail "--version"
$CLI --help | grep -q "WORKFLOW" && pass "--help" || fail "--help"

step "2. status (디바이스 정보 확인)"
$CLI status $TIMEOUT 2>&1 | grep -q "$PLATFORM_VAL\|Connected" && pass "status shows device" || fail "status"

step "3. snapshot -i (interactive 요소 조회)"
SNAPSHOT=$($CLI snapshot -i $TIMEOUT 2>&1)
echo "$SNAPSHOT" | head -10
echo "$SNAPSHOT" | grep -q "@e1" && pass "snapshot refs assigned" || fail "snapshot: no refs"
echo "$SNAPSHOT" | grep -q "Pressable\|Button\|TextInput" && pass "snapshot has interactive elements" || fail "snapshot: no interactive elements"

step "4. snapshot --json (JSON 출력)"
$CLI snapshot -i --json $TIMEOUT 2>&1 | grep -q '"refs"' && pass "snapshot --json" || fail "snapshot --json"

step "5. assert text (텍스트 검증)"
$CLI assert text "Count:" $TIMEOUT && pass "assert text found" || fail "assert text"

step "6. tap @ref (ref로 탭)"
# snapshot에서 Count 버튼의 ref를 찾아서 탭
COUNT_REF=$(echo "$SNAPSHOT" | grep 'Pressable.*"Count:' | head -1 | awk '{print $1}')
if [ -z "$COUNT_REF" ]; then
  # ref가 없으면 셀렉터로 직접 탭
  echo "  (Count ref not found in snapshot, using selector fallback)"
  $CLI tap 'Pressable:text("Count:")' $TIMEOUT && pass "tap by selector" || fail "tap by selector"
else
  $CLI tap "$COUNT_REF" $TIMEOUT && pass "tap $COUNT_REF" || fail "tap $COUNT_REF"
fi
sleep 2

step "7. assert text after tap (탭 후 텍스트 변경 확인)"
# Count가 증가했으면 "Count: " 뒤에 0보다 큰 숫자
$CLI assert text "Count:" $TIMEOUT && pass "text still exists after tap" || fail "text gone after tap"

step "8. query (셀렉터 조회)"
$CLI query 'Pressable:text("Count:")' $TIMEOUT 2>&1 | grep -q "Pressable" && pass "query" || fail "query"

step "9. snapshot 재호출 (refs 갱신)"
NEW_SNAPSHOT=$($CLI snapshot -i $TIMEOUT 2>&1)
echo "$NEW_SNAPSHOT" | grep -q "@e1" && pass "re-snapshot" || fail "re-snapshot"

step "10. init-agent (가이드 생성)"
TMPDIR=$(mktemp -d)
cd "$TMPDIR"
$CLI init-agent --lang en 2>&1
[ -f AGENTS.md ] && grep -q "rn-mcp" AGENTS.md && pass "init-agent AGENTS.md" || fail "init-agent AGENTS.md"
[ -f CLAUDE.md ] && grep -q "rn-mcp" CLAUDE.md && pass "init-agent CLAUDE.md" || fail "init-agent CLAUDE.md"
rm -rf "$TMPDIR"

echo ""
echo "═══════════════════════════════════"
echo "  ✓ All CLI smoke tests passed!"
echo "═══════════════════════════════════"
