---
name: tool-get-by-label
description: MCP get_by_label / get_by_labels 호출 또는 Fiber 라벨 검색·click_by_label 실패 디버깅 시 사용.
---

# get_by_label / get_by_labels

## 동작

- **get_by_label(label?)**: eval `__REACT_NATIVE_MCP__.getByLabel(label)`. 훅 존재, renderer, root, **labelsWithOnPress**, **label** 매칭 여부 반환. **click_by_label** 실패 시 훅/라벨 확인용.
- **get_by_labels**: eval `__REACT_NATIVE_MCP__.getByLabels()`. 동일 훅 정보 + onPress 라벨 전체 목록. **label**은 get_by_label에서만 선택 사용.
