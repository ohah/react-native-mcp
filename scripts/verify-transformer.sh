#!/usr/bin/env bash
# Metro transformer 적용 여부 확인: 번들 생성 후 __REACT_NATIVE_MCP__ 및 testID 포함 여부 검사
# 사용: scripts/verify-transformer.sh [앱 경로]
# 기본 앱 경로: examples/demo-app

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
APP_DIR="${1:-$ROOT/examples/demo-app}"
OUT="$ROOT/.tmp-verify-bundle.js"

echo "Building bundle from: $APP_DIR"
mkdir -p "$(dirname "$OUT")"
cd "$APP_DIR"
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output "$OUT" \
  --reset-cache \
  2>&1 | tail -5
cd "$ROOT"

echo ""
if grep -q '__REACT_NATIVE_MCP__' "$OUT" 2>/dev/null; then
  echo "  [OK] AppRegistry 래퍼(__REACT_NATIVE_MCP__) 적용됨"
else
  echo "  [FAIL] __REACT_NATIVE_MCP__ not found in bundle"
  exit 1
fi

if grep -qE 'testID:\s*"[^"]+"' "$OUT" 2>/dev/null; then
  echo "  [OK] testID 자동 주입 적용됨"
else
  echo "  [FAIL] testID pattern not found in bundle"
  exit 1
fi

echo ""
echo "Verification passed. Bundle: $OUT"
rm -f "$OUT"
