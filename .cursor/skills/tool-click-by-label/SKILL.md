---
name: tool-click-by-label
description: MCP click_by_label 호출 또는 testID가 없을 때 보이는 텍스트로 클릭할 때 사용.
---

# click_by_label

## 동작

- 서버가 **eval** 전송: `__REACT_NATIVE_MCP__.pressByLabel(label, index?)`. 앱은 **React DevTools 훅**으로 Fiber를 순회해, 서브트리 텍스트에 **label**을 포함하는 **onPress** 노드를 찾고, n번째 매칭(0-based **index**)의 onPress 호출.
- testID 없이 동작. ****REACT_DEVTOOLS_GLOBAL_HOOK****(DevTools/디버그 빌드) 필요. 실패 시 **get_by_label**로 훅/라벨 확인.
