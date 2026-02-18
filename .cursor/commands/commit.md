# 프로젝트 규칙에 따라 변경사항 커밋

커밋 생성·제안 시 **AGENTS.MD의 커밋 규칙**을 적용한다.

## 메시지 형식

```
<type>(<scope>): <subject>

<body>

<footer>
```

- **Type** (필수): `feat` | `fix` | `refactor` | `test` | `docs` | `chore` | `style`
- **Scope** (선택): `server` | `react-native` | `docs` | `scripts` | `config`
- **Subject** (필수): **한국어**, 명령형, 50자 이하, 마침표 없음
- **Body** (선택): **한국어**, 72자마다 줄바꿈, 무엇을·왜 변경했는지 설명
- **Footer** (선택): Breaking changes, Issue 번호

## 원칙

1. 커밋당 단일 목적
2. 관련 없는 변경은 별도 커밋으로 분리
3. 각 커밋은 독립적으로 의미 있어야 함
4. 작고 논리적인 단위로 커밋

## 커밋 전 (필수)

도구 버전은 [mise](https://mise.jdx.dev/)로 관리 (`.mise.toml`). `mise exec --`로 프로젝트 bun 사용.

1. **브랜치 먼저 생성** — 새 작업 시 `git checkout -b <branch>`로 브랜치 생성 후 해당 브랜치에서 커밋.
2. `mise exec -- bun run format` 실행
3. `mise exec -- bun run lint` 실행
4. 변경 파일 스테이징 후 커밋

## 커밋 후 (필수)

커밋 후 **요약용 MD 파일** 작성 (이 파일은 커밋하지 않음).

- **제목**: 브랜치명 또는 커밋 주제
- **작업 내용**: 목표, 변경사항, 결과를 산문체로 작성

## 예시

```
feat(server): MCP 서버 및 도구 지원 추가

- MCP 프로토콜 기반 서버 구현
- 여러 도구(Tool) 등록 및 실행 지원
```

```
fix(react-native): WebSocket 재연결 처리 수정

- 연결 끊김 시 재연결 로직 수정
- 지수 백오프 적용
```
