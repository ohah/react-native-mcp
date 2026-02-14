---
name: tool-list-clickables
description: MCP list_clickables 호출 또는 RN 앱에서 클릭 가능 요소(uid + label) 목록이 필요할 때 사용.
---

# list_clickables

## 동작

- 서버가 **eval** 전송: `__REACT_NATIVE_MCP__.getClickables()`. 앱이 Fiber를 순회해 **onPress** 있는 노드를 수집하고, 각각 **uid**(testID 또는 경로)와 **label**(서브트리 텍스트 합침) 반환. 라벨은 DevTools 훅이 있어야 런타임 텍스트 수집.
- 반환된 **uid**로 **click(uid)** 또는 **label**로 **click_by_label** 사용. 파라미터 없음.
