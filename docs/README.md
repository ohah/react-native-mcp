# React Native MCP — 내부 문서

에이전트·기여자를 위한 내부 개발 문서 인덱스.
사용자 대상 문서는 **[rspress](../document/docs/)** 참고.

---

## Architecture — 아키텍처·설계

- [Overview](architecture/overview.md) — 프로젝트 개요, 패키지 구조
- [Design Decisions](architecture/design-decisions.md) — 핵심 기술 결정과 근거 (ADR)

## References — 플랫폼 CLI 참조

- [ADB](references/adb.md) — Android Debug Bridge 레퍼런스
- [idb](references/idb.md) — iOS Development Bridge 레퍼런스
- [XCUITest / WDA](references/xcuitest-wda.md) — XCUITest·WebDriverAgent 레퍼런스
- [idb 설치 가이드](references/idb-setup.md) — idb 설치·설정·트러블슈팅
- [Orientation & Coordinates](references/orientation-coordinates.md) — iOS 화면 방향·idb 좌표 변환

## Specs — 제품 스펙·비교

- [E2E 도구 비교](specs/e2e-comparison.md) — vs Detox, Maestro, Appium
- [VS Code Extension](specs/vscode-extension.md) — VS Code 확장 아키텍처·패널 설계

## Guides — 기여자 가이드

- [Coding Style](guides/coding-style.md) — 코딩 스타일 (JSDoc, 한글 주석 등)
- [Commit Rules](guides/commit-rules.md) — 커밋 메시지 규칙
- [PR Rules](guides/pr-rules.md) — Pull Request 규칙
- [Development Commands](guides/development-commands.md) — 개발 명령어
- [Tech Stack](guides/tech-stack.md) — 기술 스택
- [Monorepo](guides/monorepo.md) — 모노레포 구조·배포

## Troubleshooting — 문제 해결

- [App Connection](troubleshooting/app-connection.md) — 앱 연결 안 됨 원인·진단·해결
- [E2E CI Reliability](troubleshooting/e2e-ci-reliability.md) — CI E2E 안정성 패턴
- [CI E2E Failure Analysis](troubleshooting/ci-e2e-failure-analysis.md) — CI 실패 분석

## Legacy — 역할 완료 (참고용)

- [DESIGN.md](legacy/DESIGN.md) — 원본 설계 문서 (ADR은 architecture/design-decisions.md로 추출됨)
- [Feature Roadmap](legacy/feature-roadmap.md) — 완료된 기능 로드맵
- [E2E YAML Roadmap](legacy/e2e-yaml-roadmap.md) — E2E YAML 스텝 로드맵
- [E2E Test Plan](legacy/e2e-test-plan.md) — 초기 E2E 테스트 전략
- [Production Readiness Brainstorm](legacy/brainstorms/2026-02-21-production-readiness.md) — 상용 준비 브레인스토밍

---

> **단일 소스 원칙**: 사용자 대상 문서(도구 레퍼런스, E2E 가이드, 쿡북 등)는
> [rspress](../document/docs/)에서만 관리한다. 이 디렉토리는 내부 개발용.
