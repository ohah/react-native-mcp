---
name: tool-click
description: React Native 앱에서 MCP click 호출 또는 testID(uid)로 눌러서 트리거할 때 사용.
---

# click

## 동작

- 서버가 앱에 **eval** 전송: `__REACT_NATIVE_MCP__.triggerPress(uid)`.
- 앱은 **testID**로 등록된 ref 맵(Babel 또는 수동 등록)에서 요소를 찾아 뷰의 press 핸들러(예: onPress) 호출.
- **uid**는 등록된 testID여야 함. 경로 형식 uid(예: "0.1.2")는 대부분 동작하지 않음. testID가 없으면 **click_by_label** 사용 권장.
