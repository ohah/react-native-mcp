# React Native MCP 기여하기

React Native MCP 프로젝트에 기여해주셔서 감사합니다!

커뮤니티의 기여를 환영하며, 프로젝트 개선을 위한 노력에 감사드립니다.

## 목차

- [Code of Conduct](#code-of-conduct)
- [도움 받기](#도움-받기)
- [기여 방법](#기여-방법)
- [개발 환경 설정](#개발-환경-설정)
- [개발 서버 실행](#개발-서버-실행)
- [테스트](#테스트)
- [코드 품질 검사](#코드-품질-검사)
- [Pull Request 프로세스](#pull-request-프로세스)
- [커밋 메시지 가이드라인](#커밋-메시지-가이드라인)

## Code of Conduct

이 프로젝트는 [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/)를 준수합니다. 참여하시는 모든 분은 이 규칙을 준수해주시기 바랍니다.

## 도움 받기

프로젝트에 대한 질문이나 시작하는 데 도움이 필요하시면 [GitHub Discussions](https://github.com/ohah/react-native-mcp/discussions) 페이지를 이용해주세요.

## 기여 방법

React Native MCP에 기여하는 방법은 여러 가지가 있습니다:

- **버그 리포트**: 버그를 발견하셨다면, 명확한 설명과 재현 단계를 포함하여 [이슈를 열어주세요](https://github.com/ohah/react-native-mcp/issues/new).
- **기능 제안**: 새로운 기능 아이디어가 있으시면 Discussion을 시작하거나 이슈를 열어 의견을 공유해주세요.
- **문서 개선**: 오타 수정, 예제 추가, 설명 개선 등으로 문서를 개선해주세요.
- **Pull Request 제출**: 버그 수정, 기능 추가, 기존 코드 개선을 위한 PR을 제출해주세요.

## 개발 환경 설정

React Native MCP는 [mise](https://mise.jdx.dev/)를 사용하여 Bun 버전을 관리하여 팀 전체에서 일관된 개발 환경을 유지합니다.

### 1. 프로젝트 설정

```bash
# mise 신뢰 및 도구 설치
mise trust
mise install
```

### 2. 의존성 설치

```bash
# Bun 워크스페이스 의존성 설치
bun install
```

## 개발 서버 실행

### 통합 개발 환경

간소화된 개발 환경을 위해 하나의 명령어로 모든 서비스를 실행할 수 있습니다:

```bash
bun run dev
```

### 개별 서버 실행

개발 중에는 각 패키지를 개별적으로 실행할 수 있습니다:

```bash
# MCP 서버 실행
bun run dev:server
```

## 테스트

### TypeScript/JavaScript 테스트

각 패키지별로 테스트를 실행할 수 있습니다:

```bash
# 전체 테스트 실행
bun run test:unit

# 커버리지 포함 테스트
bun run test:coverage
```

## 코딩 스타일 가이드라인

### 주석 스타일

모든 주석은 **한글**로 작성합니다.

**예시**:

```typescript
// 연결 상태 업데이트
function updateConnection() {
  // ...
}

// WebSocket 메시지 처리
async function handleMessage(msg: string) {
  // ...
}
```

**원칙**:

- 한글로 간결하게 작성
- 짧은 주석은 한 줄로 작성
- 긴 설명이 필요한 경우 여러 줄로 나누어 작성 가능
- 코드 자체로 명확한 경우 주석 생략 가능

## 코드 품질 검사

Pull Request를 제출하기 전에 모든 코드 품질 검사를 통과했는지 확인하세요.

### TypeScript/JavaScript

- **Lint 검사**:

  ```bash
  bun run lint
  ```

- **포맷팅 검사 및 적용**:

  ```bash
  # 포맷팅 적용
  bun run format

  # 포맷팅 검사만 (CI용)
  bun run format:check
  ```

### 중요 사항

- PR을 열기 전에 로컬에서 모든 품질 검사를 실행하세요.
- CI는 빌드 프로세스와 테스트를 포함한 포괄적인 검증을 실행합니다.
- 모든 검사가 통과해야 PR이 병합될 수 있습니다.

## Pull Request 프로세스

1. **저장소 포크**: GitHub에서 저장소를 포크합니다.
2. **변경사항 구현**: 버그 수정, 기능 추가, 개선사항을 구현합니다.
3. **로컬 테스트**: 위에 언급된 모든 코드 품질 검사를 실행하여 모든 것이 통과하는지 확인합니다.
4. **변경사항 커밋**: [커밋 메시지 가이드라인](#커밋-메시지-가이드라인)을 따릅니다.
5. **Push 및 Pull Request 생성**: 브랜치를 푸시하고 `main` 브랜치에 대한 PR을 엽니다.
6. **CI 검증**: CI 워크플로우는 모든 품질 검사, 빌드 프로세스, 테스트를 실행합니다.

## 커밋 메시지 가이드라인

우리는 [Conventional Commits](https://www.conventionalcommits.org/) 사양을 따릅니다.

### 형식

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

### Type (필수)

- `feat`: 새로운 기능 추가
- `fix`: 버그 수정
- `refactor`: 코드 리팩토링 (기능 변경 없음)
- `test`: 테스트 추가/수정
- `docs`: 문서 업데이트
- `chore`: 빌드 설정, 의존성 업데이트 등
- `style`: 코드 포맷팅, 세미콜론 누락 등 (기능 변경 없음)

### Scope (선택)

- `server`: MCP 서버 패키지 관련
- `react-native`: React Native 클라이언트 관련
- `docs`: 문서 관련
- `scripts`: 빌드/초기화 스크립트 관련
- `config`: 프로젝트 설정 파일 관련

### 커밋 원칙

1. **단일 목적**: 하나의 커밋은 하나의 목적만 가져야 함
2. **논리적 분리**: 관련 없는 변경사항은 별도 커밋으로 분리
3. **독립적 의미**: 각 커밋은 독립적으로 의미가 있어야 함
4. **되돌리기 용이**: 특정 기능만 되돌릴 수 있도록 구성
5. **작은 단위**: 가능한 작은 단위로 커밋 (하지만 너무 작지 않게)

---

React Native MCP에 기여해주셔서 감사합니다! 여러분의 노력이 이 프로젝트를 더 나은 도구로 만들어줍니다.
