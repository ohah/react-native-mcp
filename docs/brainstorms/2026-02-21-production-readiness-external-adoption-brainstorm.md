# 브레인스토밍: 상용 수준 안정화 — 외부 채택 (1번) 구체화

**날짜**: 2026-02-21  
**목표**: 다른 팀/회사가 "이걸 프로덕션에 써도 된다"라고 판단할 수 있도록, 1·2·3번(호환성, 체크리스트, 제한·리스크)을 모두 구체화한다.

---

## What We're Building

- **1번**: 호환성·요구사항이 명확한 문서/매트릭스
- **2번**: 채택 전 "이것만 확인하면 된다"는 체크리스트
- **3번**: 알려진 제한·리스크 및 권장/비권장 사용법 문서

세 가지를 한 덩어리로 다루되, **외부 채택(1번)** 에 집중한 최소 구현 범위로 정리한다.

---

## 1. 호환성·요구사항 명확화 (구체 항목)

**목적**: "이 버전이면 동작한다"를 한눈에 보이게 한다.

### 1.1 문서 위치·이름 제안

- **문서**: `docs/compatibility-and-requirements.md`
- 기존 `expo-guide.md`의 "호환성 요약" 표는 유지하고, 이 문서에서 **전체 요구사항**을 정리한 뒤 expo-guide는 "Expo 관련만 상세"로 링크하도록 한다.

### 1.2 포함할 구체 항목

| 항목                 | 내용                                                            | 현재 출처/비고                                  |
| -------------------- | --------------------------------------------------------------- | ----------------------------------------------- |
| **Node**             | `>=24` (engines)                                                | `packages/react-native-mcp-server/package.json` |
| **Bun**              | `>=1.0.0` (선택, engines)                                       | 동일                                            |
| **React Native**     | **0.74 이상** (New Architecture 기준). 0.83.x 검증 완료         | feature-roadmap, demo-app                       |
| **New Architecture** | 최소 지원 0.74 (New Arch). Fabric 0.83.x 검증 완료              | feature-roadmap §1                              |
| **Expo**             | Dev Client ✅, Expo Go △, EAS Build(production) 시 MCP 비활성화 | expo-guide                                      |
| **Hermes**           | 필수(가정) — 문서에 명시                                        | overview/architecture                           |
| **OS (서버)**        | macOS(idb), Windows/Linux(Android adb만)                        | idb-setup, DESIGN                               |
| **iOS**              | 시뮬레이터 권장, 실기기 터치 주입 미지원                        | DESIGN 13.7, idb-setup                          |

### 1.3 형식

- **표 1개**: 환경별 지원(O / △ / X) + 비고 한 줄.
- **버전 매트릭스**: RN 버전 × Expo 사용 여부(bare / Expo Dev Client / Expo Go) 간단 표.
- **문서 원칙**: 72자 줄바꿈, 변경 시 `package.json` engines / feature-roadmap과 동기화한다.

---

## 2. 채택 시 체크리스트 (구체 항목)

**목적**: 도입 전에 "이것만 확인하면 된다"는 항목을 한 페이지에 정리한다.

### 2.1 문서 위치·이름 제안

- **문서**: `docs/adoption-checklist.md`

### 2.2 포함할 구체 항목

| #   | 체크 항목        | 설명 (한 줄)                                                                                                     |
| --- | ---------------- | ---------------------------------------------------------------------------------------------------------------- |
| 1   | **호환성**       | [compatibility-and-requirements.md](compatibility-and-requirements.md)에서 RN/Expo/Node 버전 충족 여부 확인      |
| 2   | **포트**         | MCP 서버·앱 기본 포트(예: 12300)가 방화벽/공유기에서 막히지 않는지 (로컬/팀 네트워크)                            |
| 3   | **Metro**        | MCP 사용 시 Metro는 `--config`로 프로젝트 `metro.config.js` 사용 권장 (8230 등 충돌 방지)                        |
| 4   | **환경 변수**    | 개발: 기본 연결. 프로덕션 번들에서 MCP 쓰려면 `REACT_NATIVE_MCP_ENABLED=true`로 Metro 실행 — 보안·노출 검토 필요 |
| 5   | **보안**         | localhost/제한된 네트워크만 허용하는지, 프로덕션에서는 기본 비활성화 권장(문서에 명시)                           |
| 6   | **E2E(idb/adb)** | iOS는 idb(macOS), Android는 adb 설치·경로 확인; 실기기 시 터치 제한 있음(제한사항 문서 참고)                     |

### 2.3 형식

- 마크다운 체크리스트(`- [ ]`, `- [x]`)로 "도입 전 확인"용.
- 각 항목 아래 "자세한 내용: docs/xxx 링크" 한 줄만 두어, 문서가 길어지지 않게 한다.

---

## 3. 알려진 제한·리스크 문서 (구체 항목)

**목적**: "이런 경우엔 쓰지 마라 / 이렇게 쓰면 된다"를 한곳에 정리한다.

### 3.1 문서 위치·이름 제안

- **문서**: `docs/known-limitations-and-risks.md`  
  기존 `DESIGN.md` 13.7, `idb-setup.md` "알려진 제한사항", `expo-guide.md` "Expo Go 제한" 내용을 **사용자 관점**으로 재정리한 문서.

### 3.2 포함할 구체 항목

| 유형       | 항목              | 설명 요약                                                | 우회/권장                              |
| ---------- | ----------------- | -------------------------------------------------------- | -------------------------------------- |
| **플랫폼** | iOS 실기기        | idb/simctl 터치 주입 미지원                              | XCTest/WDA 또는 MCP `type_text`        |
| **플랫폼** | Android 실기기    | localhost가 호스트가 아니면 12300 접속 불가(런타임 한계) | 에뮬 또는 포워딩 설정                  |
| **입력**   | 한글(idb)         | `idb ui text "한글"` 시 앱 크래시 가능                   | MCP `type_text` 사용                   |
| **입력**   | 멀티터치          | idb/adb 단일 터치만 지원                                 | 핀치/회전 불가                         |
| **환경**   | Expo Go           | localhost WebSocket 제한 가능                            | Expo Dev Client 권장                   |
| **환경**   | 프로덕션          | 기본은 MCP 런타임 비활성화                               | 의도적으로 켤 때만 env 설정, 보안 검토 |
| **기능**   | FlatList 미렌더링 | 가상화로 인해 미렌더링 아이템은 스냅샷에 없음            | `scroll_until_visible` 후 조회         |
| **기능**   | WebView           | idb describe-all은 WebView 내부 미표시                   | `webview_evaluate_script` 우선         |
| **기타**   | iPad HID          | Return(40)이 멀티태스킹 트리거 가능                      | 앱별 확인                              |

### 3.3 형식

- 표: 제한 | 설명(한 줄) | 우회/권장(한 줄).
- 상단에 "이 문서는 채택 결정 전 제한사항·리스크 파악용" 한 문단.
- DESIGN.md / idb-setup / expo-guide는 "상세는 xxx 참고"로 링크만 유지해 중복 본문은 최소화.

### 3.4 리스크 문단 (보안·운영)

- **보안**: localhost만 허용, 프로덕션 기본 비활성화. MCP 활성화 시 포트·네트워크 노출 검토 권장.
- **운영**: 서버 메트릭/health check는 현재 없음 — 필요 시 별도 로드맵(2·3번 내부 신뢰/관찰 가능성에서 다룸).

---

## Key Decisions

1. **문서 분리**: 호환성·체크리스트·제한사항을 각각 `compatibility-and-requirements.md`, `adoption-checklist.md`, `known-limitations-and-risks.md`로 두고, 링크로 연결한다.
2. **기존 문서 재사용**: DESIGN.md 13.7, idb-setup, expo-guide의 표를 복붙하지 않고 "사용자 관점 요약 + 링크"로 통합한다.
3. **YAGNI**: 상용화 1단계는 "문서화"에 한정. 메트릭/health check/커버리지 게이트는 2·3번(내부 신뢰, 관찰 가능성)에서 다룬다.

---

## Resolved Questions

- **문서 구조**: 3개 파일로 분리 — `compatibility-and-requirements.md`, `adoption-checklist.md`, `known-limitations-and-risks.md`.
- **RN 최소 지원**: **0.74 (New Architecture)**. 호환성 문서·버전 매트릭스에 "0.74 이상, 0.83.x 검증 완료"로 명시한다.
- **체크리스트 검증**: **CI/스크립트로 검증**한다. 자동 검증 가능 항목(Node, RN 버전, 선택적 포트)만 스크립트로 확인하고, 체크리스트 문서에는 "자동 검증: `…` 실행" 안내를 둔다.

## Open Questions

- (없음)

---

## Next Steps (Handoff)

- 위 Open Questions에 대한 답을 정리한 뒤, **설계 확정**하고 `docs/plans/YYYY-MM-DD-production-readiness-docs-design.md`에 구현 단위(문서 경로, 표 포맷, 링크 구조)를 적는다.
- 구현 시: 1) 호환성 문서, 2) 체크리스트, 3) 제한·리스크 문서 순으로 작성하고, 기존 문서(expo-guide, DESIGN, idb-setup)에 "자세한 내용은 docs/xxx 참고" 링크를 추가한다.
