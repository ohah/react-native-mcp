---
title: Rspress 미문서 갭 조사 — 구현됐으나 문서에 없는 항목 정리
type: docs
status: active
date: 2026-02-23
---

# Rspress 미문서 갭 조사

## Overview

코드베이스에는 구현되어 있으나 **rspress**(`document/docs`) 사이트에 설명되지 않았거나 부족한 항목을 체계적으로 조사하고, 조사 결과를 바탕으로 문서 보강 범위를 정리한다.  
코딩은 하지 않고, **조사·플랜 단계**만 수행한다.

## Problem Statement / Motivation

- 사용자·기여자는 rspress만 보고 “전체 기능”을 파악한다고 가정하는데, `docs/`(repo root)나 코드에만 있는 내용이 있으면 갭이 생긴다.
- MCP 도구 수(overview 47 vs description 38), E2E 스텝 수(32 vs 34) 등 **수치·카테고리 불일치**가 문서 내에 존재한다.
- 새로 추가된 도구(비디오 녹화, get_component_source)나 Babel/CLI 옵션이 rspress에 반영되지 않은 상태를 한 번에 정리할 필요가 있다.

## Proposed Solution

1. **갭 조사**: 구현(도구·E2E 스텝·Babel·CLI) vs rspress 문서를 항목별로 대조해 “미문서/부족” 목록을 만든다.
2. **수치·범위 정리**: 도구 개수, E2E 스텝/카테고리 수, clear 등 통합 인덱스 누락을 명시한다.
3. **docs/ vs rspress**: repo root `docs/` 전용 파일(idb-setup, ADB_REFERENCE 등)에 대해 “rspress 반영 vs 링크만 vs 유지 안 함” 방침을 제안한다.
4. **산출물**: 이 플랜 문서에 조사 결과·체크리스트를 반영하고, 필요 시 별도 이슈/태스크로 문서 반영 작업을 나눈다.

## Research Findings (Consolidated)

### (A) MCP 도구 — 미문서·부족

| 항목                    | 소스                                                       | rspress 상태                | 제안                                                              |
| ----------------------- | ---------------------------------------------------------- | --------------------------- | ----------------------------------------------------------------- |
| `get_component_source`  | `tools/get-component-source.ts`                            | **미문서**                  | Element Query 페이지에 추가 (selector/uid → file:line).           |
| `start_video_recording` | `tools/video-recording.ts`                                 | **미문서**                  | Screen Capture에 “Video recording” 섹션 또는 별도 서브페이지.     |
| `stop_video_recording`  | 동일                                                       | **미문서**                  | 위와 동일.                                                        |
| `clear`                 | 여러 도구 페이지에서 “Use clear (target: …)” 형태로만 언급 | **파라미터·전용 섹션 없음** | Console & Network에 `clear` 섹션 추가: `target` enum, 옵션, 예시. |

- **Overview 수치**: “47 tools” vs description “38 MCP tools” 불일치. 카테고리별 실제 도구 수에 맞춰 overview·description 통일 필요.

### (B) docs/ (repo root) — rspress 미반영

| docs/ 파일                                                                             | rspress 대응                                  | 제안                                                                       |
| -------------------------------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- |
| `idb-setup.md`                                                                         | 없음 (getting-started에 idb 언급만)           | rspress에 idb 설치·설정 전용 페이지 또는 compatibility에 통합.             |
| `ADB_REFERENCE.md`                                                                     | 없음                                          | 참조용 “ADB reference” 페이지 추가 권장.                                   |
| `IDB_REFERENCE.md`                                                                     | 없음                                          | 참조용 “IDB reference” 페이지 추가 권장.                                   |
| `e2e-orientation-and-idb-coordinates.md`                                               | 없음                                          | E2E/방향·좌표 이슈 시 유용. testing 또는 troubleshooting에 요약·링크 권장. |
| `troubleshooting-app-connection.md`, `troubleshooting-app-connected-false.md`          | `mcp/troubleshooting.md` 존재                 | rspress와 1:1 대응 여부 확인 후, 통합 또는 “see rspress” 링크 정리.        |
| `expo-guide.md`, `compatibility-and-requirements.md` 등                                | `document/docs/en/mcp/` 아래 대응 페이지 있음 | 내용 동기화 여부만 점검.                                                   |
| `DESIGN.md`, `feature-roadmap.md`, `chrome-devtools-mcp-spec-alignment.md`, `cdp-*.md` | 없음                                          | 설계/내부용. rspress 반영 불필요로 두어도 됨.                              |

### (C) 기타 구현 vs rspress 갭

| 항목                     | 구현                                                          | rspress 상태                                                                                                            | 제안                                                                           |
| ------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **E2E YAML Video 스텝**  | `startRecording` / `stopRecording` (types, runner, parser)    | e2e-yaml-reference에 Video 카테고리·스텝 나열되나, **steps/screenshots.md**에는 startRecording/stopRecording 설명 없음. | steps에 Video 스텝 파라미터·예시 추가 또는 `steps/video.md` 신설.              |
| **E2E 스텝·카테고리 수** | 34 step types, 8 categories (Video 포함)                      | steps/overview “32 step types”, “7 categories”                                                                          | 34·8로 통일하고 Video를 overview·sidebar에 반영.                               |
| **Babel preset 옵션**    | `renderHighlight`, `REACT_NATIVE_MCP_ENABLED`, testID 주입 등 | renderHighlight는 일부 페이지만 언급. **옵션만 모은 레퍼런스 페이지 없음.**                                             | “Install & connect” 또는 전용 “Babel preset reference”에 옵션 표 추가.         |
| **Babel testID 주입**    | `babel-plugin-inject-testid.cjs`                              | rspress에 “inject-testid”/옵션 문서 없음.                                                                               | architecture와 연계해 동작·옵션 요약 추가.                                     |
| **CLI 서브커맨드**       | `init`, `test run`, `test report show` 등                     | cli-init, e2e-yaml-reference에 일부만 다뤄짐.                                                                           | E2E YAML 레퍼런스 “CLI” 섹션 또는 “CLI reference”에 서브커맨드·옵션 목록 정리. |

### (D) 문서·링크 정리

- **AGENTS.MD**: E2E YAML 레퍼런스를 `docs/e2e-yaml-reference.md`로 링크하고 있으나, 해당 파일은 repo에 없고 `document/docs/.../e2e-yaml-reference.md`에만 있음. 링크를 rspress 경로(또는 상대 경로)로 수정 권장.
- **docs/README.md**: “published docs”가 `../document/docs/`로 이동했다고 명시됨. 사용자용 단일 소스는 rspress로 유지.

## Technical Considerations

- **조사 범위**: MCP 도구, E2E YAML 스텝, Babel preset/플러그인 옵션, CLI 서브커맨드, repo root `docs/` 파일. 스크립트(doctor, test-get-component-source-mcp 등)는 “기여자용”으로 두고 조사 범위에 포함 여부를 명시하면 됨.
- **en/ko 동시 점검**: “rspress에 있다” 판단 시 en만 보지 말고, ko 동일 반영 여부까지 체크할 것.
- **완료 정의**: “조사 완료” = 갭 목록 + 카테고리/수치 불일치 원인 정리. “문서 반영 완료” = 별도 태스크로, 이 플랜의 권장 사항을 적용한 실제 수정.

## Acceptance Criteria

### 조사 완료

- [ ] **AC1** MCP 도구 `get_component_source`, `start_video_recording`, `stop_video_recording` 각각이 rspress에 문서화되어 있는지 여부가 명시되어 있다.
- [ ] **AC2** `docs/` 전용 파일(idb-setup, ADB_REFERENCE, IDB_REFERENCE 등)이 rspress에 반영되었는지/링크만 있는지/미반영인지가 항목별로 기록되어 있다.
- [ ] **AC3** E2E 스텝 수·카테고리 불일치(32 vs 34, 7 vs 8)의 원인(예: Video 카테고리/스텝 포함 여부)이 파악되어 있다.
- [ ] **AC4** Babel preset 옵션(renderHighlight 등)이 rspress에 레퍼런스로 정리되어 있는지 여부가 기록되어 있다.
- [ ] **AC5** CLI 서브커맨드(init / test / report 등)가 rspress에 어디에 어떻게 문서화되어 있는지 매핑되어 있다.
- [ ] **AC6** 위 항목 외 “구현만 있고 rspress에 없음”으로 판단된 항목이 목록으로 정리되어 있다.
- [ ] **AC7** 도구 개수(47 vs 38) 및 카테고리 정의 일치 여부가 조사 산출물에 포함되어 있다.
- [ ] **AC8** 항목별 en/ko 동일 반영 여부가 점검되어 있다.

### 문서 반영(별도 작업 시)

- [ ] **AC9** “미문서/부족”으로 표시된 항목마다, rspress에 추가·수정할 페이지/섹션과 요약 내용이 지정되어 있다.
- [ ] **AC10** 스텝 수/카테고리 불일치에 대한 결정(32 vs 34 통일 방식)이 적용되어, e2e-yaml-reference와 steps/overview가 일치한다.
- [ ] **AC11** docs/ 전용 파일에 대해 “rspress에 본문 반영 vs 링크만 vs 유지 안 함”이 항목별로 결정·반영되어 있다.

## Success Metrics

- 갭 목록이 한 문서에서 추적 가능하고, 우선순위·담당을 나누기 쉬운 형태로 정리됨.
- 문서 반영 작업 시 “어디를 고칠지”를 이 플랜만 보고 결정할 수 있음.

## Dependencies & Risks

- rspress와 repo root `docs/` 이중 유지로 인한 동기화 누락. 단일 소스(rspress) 원칙을 명확히 하고, AGENTS.MD 등 링크를 rspress 기준으로 정리하면 리스크 감소.

## References & Research

- **Repo research**: `packages/react-native-mcp-server/src/tools/index.ts`, `document/docs/en/mcp/tools/*.md`, `document/docs/en/testing/**`.
- **Plans**: `docs/plans/2026-02-21-production-readiness-docs-design.md`, `docs/plans/2026-02-21-feat-e2e-video-recording-plan.md`.
- **Docs policy**: `docs/README.md` (published docs → document/docs).
