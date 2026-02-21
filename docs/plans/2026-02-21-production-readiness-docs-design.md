# 설계: 상용 준비 문서 및 체크리스트 검증 스크립트

**날짜**: 2026-02-21  
**근거**: [브레인스토밍 2026-02-21](../brainstorms/2026-02-21-production-readiness-external-adoption-brainstorm.md)

---

## 목표

- 외부 채택 시 "이 버전이면 된다"를 명시하는 **호환성 문서**
- 도입 전 확인용 **체크리스트** + **자동 검증 스크립트**
- 채택 전 **알려진 제한·리스크** 한곳 정리

---

## 구현 단위

### 1. 문서 3개

| 문서               | 경로                                     | 내용 요약                                                                                    |
| ------------------ | ---------------------------------------- | -------------------------------------------------------------------------------------------- |
| 호환성·요구사항    | `docs/compatibility-and-requirements.md` | Node ≥24, RN ≥0.74(New Arch), Expo 요약, Hermes, OS, 환경별 O/△/X 표 + RN×Expo 버전 매트릭스 |
| 도입 전 체크리스트 | `docs/adoption-checklist.md`             | 6항목 체크리스트(호환성, 포트, Metro, env, 보안, E2E) + "자동 검증: 아래 스크립트 실행" 안내 |
| 알려진 제한·리스크 | `docs/known-limitations-and-risks.md`    | 플랫폼/입력/환경/기능/기타 표(제한 \| 설명 \| 우회) + 보안·운영 한 문단, 기존 문서 링크      |

### 2. 체크리스트 자동 검증 스크립트

- **위치**: `packages/react-native-mcp-server/scripts/doctor.mjs`
- **실행**: 앱 루트에서 `npx @ohah/react-native-mcp-server doctor` 또는 `node node_modules/.../scripts/doctor.mjs`, 패키지 내부에서 `bun run doctor`
- **검증 항목** (자동화 가능한 것만):
  1. **Node**: `process.version` ≥ 24 (또는 engines.node 파싱). 실패 시 exit 1.
  2. **React Native**: 현재 디렉터리 또는 상위 `package.json`에서 `dependencies["react-native"]` / `devDependencies["react-native"]` semver ≥ 0.74.0. 없으면 스킵(서버만 설치한 경우). 실패 시 exit 1.
- **출력**: 성공 시 "Adoption check passed." 한 줄, 실패 시 항목별 이유 stderr + exit 1. CI에서 그대로 사용 가능.
- **배포**: 패키지 `files`에 `scripts/doctor.mjs` 포함해 npm publish 시 포함.

### 3. 기존 문서 링크

- `docs/expo-guide.md`: 상단 또는 호환성 요약 근처에 "전체 요구사항은 [compatibility-and-requirements.md](compatibility-and-requirements.md) 참고" 추가.
- `docs/DESIGN.md` 13.7 알려진 제한사항: "사용자 관점 요약은 [known-limitations-and-risks.md](known-limitations-and-risks.md) 참고" 한 줄.
- `docs/idb-setup.md` 알려진 제한사항: 동일하게 known-limitations-and-risks 링크.

---

## 구현 순서

1. `docs/compatibility-and-requirements.md` 작성
2. `docs/adoption-checklist.md` 작성 (스크립트 실행 방법 포함)
3. `packages/react-native-mcp-server/scripts/doctor.mjs` 작성
4. `packages/react-native-mcp-server/package.json`의 `files`에 `scripts/doctor.mjs` 추가, `scripts.doctor`로 실행
5. `docs/known-limitations-and-risks.md` 작성
6. expo-guide, DESIGN, idb-setup에 위 링크 추가

---

## 검증

- 스크립트: Node 24+, RN 0.83 앱 루트에서 실행 시 성공. RN 0.73 또는 Node 20에서 실행 시 실패(exit 1).
- 문서: 기존 표·문서와 불일치 없이 링크만 추가했는지 확인.
