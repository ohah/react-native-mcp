---
name: tool-evaluate-script
description: MCP evaluate_script 호출 또는 RN 앱 컨텍스트에서 임의 JS 실행할 때 사용.
---

# evaluate_script

## 동작

- 서버가 **function**(문자열)과 선택 **args**(배열)를 앱에 **eval**로 전송. 앱은 JS 컨텍스트에서 함수를 실행하고 JSON 직렬 가능한 결과 반환. Chrome DevTools MCP와 동일(function + args).
- 다른 도구로 못 하는 일회성 조회/액션(예: 상태 읽기, 전역 호출)에 사용. WebSocket으로 앱 연결 필요.

## 제한 (require 불가)

- **`require()`는 사용할 수 없다.** React Native(Metro)는 빌드 타임에 번들하므로, 앱 런타임에서 동적으로 `require(...)`로 모듈을 불러오거나 eval로 실행하는 것은 불가능하다. 함수 안에서는 이미 로드된 앱 코드와 전역만 사용해야 한다.
