# Tap 좌표 비교: 앱 measure vs idb

## 1. 앱(React Native)에서 받은 measure

- **selector**: `#press-counter-button`
- **measure**: `pageX=533.5`, `pageY=133`, `width=113`, `height=43.5`
- **계산한 탭 좌표(중앙)**: **(590, 154.75)** → idb에 **(590, 155)** 로 전달

## 2. idb describe-all (전체 UI 트리)

동일 버튼이 idb에서도 **같은 프레임**으로 보임:

```json
{
  "AXUniqueId": "press-counter-button",
  "AXLabel": "Count: 0",
  "frame": { "x": 533.5, "y": 133, "width": 113, "height": 43.5 },
  "AXFrame": "{{533.5, 133}, {113, 43.5}}"
}
```

→ **앱 measure와 idb describe-all의 좌표계는 일치함.** 중앙 (590, 154.75)는 버튼 안쪽이 맞음.

## 3. idb describe-point (특정 좌표 요소 조회)

| 좌표 (x, y)                 | 결과                        |
| --------------------------- | --------------------------- |
| (590, 155) 우리가 탭한 좌표 | `frame: {0,0,0,0}`, 빈 요소 |
| (540, 150) 버튼 중앙 근처   | `frame: {0,0,0,0}`, 빈 요소 |
| (533, 133) 버튼 좌상단      | `frame: {0,0,0,0}`, 빈 요소 |

→ 이 시뮬레이터(iPad, iOS 17.4)에서는 **describe-point가 버튼 영역 좌표를 넣어도 빈 요소만 반환**함. idb 이슈 또는 RN 접근성 트리와의 차이 가능성.

## 4. 정리

- **앱 measure ↔ idb describe-all**: 동일 좌표계, 버튼 프레임 일치.
- **우리가 tap에 넘긴 (590, 155)**: describe-all 기준으로는 버튼 중앙과 일치.
- **tap 후 카운트가 안 올라가는 원인**은 좌표 불일치보다는, 예를 들어:
  - idb `ui tap`의 좌표계가 describe-all과 다를 수 있음(미확인)
  - iPad/시뮬레이터별 hit-test 또는 터치 전달 차이
  - iPhone 시뮬레이터에서 재현 여부 확인 권장
