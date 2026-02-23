# 설계 결정 기록 (Architecture Decision Records)

프로젝트의 핵심 기술 결정과 그 근거를 기록한다. 상세 구현은 소스 코드와 [rspress 문서](../../document/docs/) 참고.

> 원본 설계 문서: [legacy/DESIGN.md](../legacy/DESIGN.md)

---

## ADR-1: DOM 없는 환경에서 컴포넌트 접근 — React Fiber tree

**결정**: DOM 대신 React Fiber tree를 사용하여 컴포넌트 구조를 파악한다.

**근거**:

- React Native에는 DOM이 없어 `querySelector` 불가
- `__REACT_DEVTOOLS_GLOBAL_HOOK__`으로 Fiber root에 접근 가능
- `fiber.child`, `fiber.sibling`, `fiber.return`으로 트리 순회
- Old Architecture / New Architecture(Fabric) 모두 동일한 Fiber 구조

**영향**: runtime.js에 Fiber 트리 헬퍼 구현, querySelector/querySelectorAll은 Fiber 기반 셀렉터

---

## ADR-2: 코드 주입 — Metro Transformer + Babel Plugin

**결정**: Metro transformer로 런타임을 자동 주입하고, Babel plugin으로 testID/displayName/WebView ref를 주입한다.

**근거**:

- 앱에 네이티브 모듈이나 수동 코드 추가 없이 자동화
- Metro transformer: `AppRegistry.registerComponent` 있는 파일에만 런타임 주입
- Babel plugin: AST 변환으로 testID, displayName 자동 생성 (개발/프로덕션 동일)
- WebView만 Babel 주입 필수 (forwardRef 기반이라 Fiber stateNode가 null)

---

## ADR-3: 통신 방식 — WebSocket (포트 12300)

**결정**: MCP 서버가 WebSocket 서버(12300)를 띄우고, 앱 런타임이 접속하는 구조.

**근거**:

- CDP(Chrome DevTools Protocol) 방식은 Hermes 런타임의 Network domain 지원이 제한적
- WebSocket + eval로 앱 내 JS 함수를 직접 실행하는 것이 더 유연
- 다중 디바이스 동시 연결 지원 (deviceId 라우팅)

**대안 검토 (채택하지 않음)**:

- CDP-only: Network domain 미지원, 앱 내 Fiber 접근 어려움
- Metro HMR 채널 활용: HMR은 단방향이라 양방향 통신 부적합

---

## ADR-4: 스크린샷 — 호스트 CLI 기반 (네이티브 모듈 없음)

**결정**: ADB(Android) / simctl(iOS 시뮬레이터) 호스트 CLI로 스크린샷을 캡처한다.

**근거**:

- 앱에 네이티브 모듈 설치 불필요 → 제로 설정
- Android: `adb exec-out screencap -p` (PTY 손상 없이 raw PNG)
- iOS: `xcrun simctl io booted screenshot <path>` (시뮬레이터 전용)
- 실기기 iOS는 simctl 미지원 → 알려진 제한사항

---

## ADR-5: 터치 입력 — 네이티브 터치 파이프라인

**결정**: Fiber props 호출(JS 레벨) 대신 ADB/idb를 통한 네이티브 터치 주입을 기본으로 사용한다.

**근거**:

- JS onPress 호출은 실제 터치 이벤트와 다른 경로 → 시각적 피드백, ripple 등 누락
- `adb input tap` / `idb ui tap`은 OS 레벨 터치 → 실제 사용자 동작과 동일
- 좌표 기반이라 네이티브 컴포넌트(드로워, 바텀시트 등)도 조작 가능

**결과**: `click`, `click_by_label` 등 JS 기반 도구 삭제 → `tap`, `swipe` 네이티브 도구로 대체

---

## ADR-6: 네트워크 모니터링 — JS 레벨 인터셉션

**결정**: CDP Network domain 대신 `XMLHttpRequest.prototype` + `fetch` monkey-patch로 네트워크 요청을 캡처한다.

**근거**:

- Hermes CDP는 Network domain 지원이 제한적 (Network.enable 미지원 또는 불안정)
- JS 레벨 인터셉션은 Hermes/JSC 무관하게 동작
- XHR mock도 동일한 경로로 구현 가능 (Hermes에 Event 생성자 없는 문제를 `__did*` 내부 메서드로 우회)

---

## ADR-7: 다중 디바이스 지원 — deviceId 라우팅

**결정**: 모든 MCP 도구에 `deviceId`, `platform` 파라미터를 추가하여 다중 디바이스를 지원한다.

**근거**:

- CI에서 iOS + Android 동시 테스트 필요
- `resolveDevice(deviceId?, platform?)` 패턴으로 자동/수동 선택
- 1대만 있으면 자동 선택, 2대 이상이면 명시 필요

---

## ADR-8: idb/adb 통합 도구 — 플랫폼 파라미터

**결정**: `idb_tap` + `adb_tap`처럼 플랫폼별로 분리된 도구 대신, `tap(platform=ios|android)`로 통합한다.

**근거**:

- 18개 플랫폼별 도구 → 9개 통합 도구로 축소
- AI 에이전트가 도구 선택 시 혼란 감소
- 내부적으로 platform 분기하여 idb/adb 호출
