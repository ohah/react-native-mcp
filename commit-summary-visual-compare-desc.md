# visual_compare 도구 설명 보강

## 목표

MCP 도구 `visual_compare`의 description이 너무 간결해 AI가 비주얼 리그레션 용도를 제대로 해석하지 못하는 문제를 줄이기 위해, 용도와 동작을 명시한 설명으로 바꿨다.

## 변경사항

- **파일**: `packages/react-native-mcp-server/src/tools/visual-compare.ts`
- **변경 내용**: `registerTool`의 `description` 문자열 수정
  - 이전: `Compare screenshot against baseline PNG. Supports element-level cropping via selector.`
  - 이후: `Visual regression: capture current screen (or crop by selector), pixel-diff against baseline PNG; use to verify UI didn't change or to update baseline.`
- 규칙(mcp-tool-descriptions.mdc)의 “너무 짧으면 AI가 사용 시점을 놓친다”는 점을 반영해, visual regression·pixel-diff·UI 검증·베이스라인 갱신이 드러나도록 한 문장으로 보강했다.

## 결과

도구 목록(tools/list)만 봐도 AI가 “비주얼 리그레션 / UI 변경 검증·베이스라인 갱신용”으로 쓰면 된다는 것을 파악하기 쉬워진다.
