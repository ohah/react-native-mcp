---
name: tool-evaluate-script
description: MCP evaluate_script 호출 또는 RN 앱 컨텍스트에서 임의 JS 실행할 때 사용.
---

# evaluate_script

## 동작

- 서버가 **function**(문자열)과 선택 **args**(배열)를 앱에 **eval**로 전송. 앱은 JS 컨텍스트에서 함수를 실행하고 JSON 직렬 가능한 결과 반환. Chrome DevTools MCP와 동일(function + args).
- 다른 도구로 못 하는 일회성 조회/액션(예: 상태 읽기, 전역 호출)에 사용. WebSocket으로 앱 연결 필요.
