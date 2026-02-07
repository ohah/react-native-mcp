# React Native MCP 스펙

## 개요
React Native 앱을 위한 MCP (Model Context Protocol) 서버 및 도구 모음

## 주요 기능

### 1. MCP 서버
- React Native 앱과 MCP 프로토콜을 통한 통신
- 도구(Tool) 기반 인터페이스 제공
- 여러 클라이언트 동시 지원

### 2. React Native 연동
- React Native 앱 내부 상태 조회
- 네트워크 요청 모니터링
- 콘솔 로그 수집

## 기술 스택

### 백엔드
- **TypeScript** (MCP 서버)
- **WebSocket** (통신)

### 도구
- **oxlint** / **oxfmt** (코드 품질)
- **mise** (도구 버전 관리)
- **bun** (패키지 매니저 및 런타임)

**YAML/포맷터 규칙 (레포 특징)**: YAML 파일의 문자열 인용(id, text 등)은 프로젝트 포맷터(oxfmt)가 **single quote**로 맞춥니다. 이 레포의 일관된 스타일이므로, 리뷰에서 double quote로 통일하라는 제안은 고려하지 않아도 됩니다. 동작은 동일합니다.

## 아키텍처

### 패키지 구조
```
react-native-mcp/
├── packages/
│   ├── server/           # MCP 서버
│   └── react-native/     # React Native 클라이언트 라이브러리
├── examples/             # 예제 앱
└── scripts/              # 빌드/개발 스크립트
```

## 코딩 스타일 가이드라인

### 주석 규칙

모든 주석은 **한글**로 작성합니다.

#### JavaScript/TypeScript 주석

**JavaScript와 TypeScript 코드에서는 JSDoc 스타일 주석을 사용합니다.**

**JSDoc 예시**:
```typescript
/**
 * MCP 서버 설정 타입
 */
export interface ServerConfig {
  /** 서버 포트 */
  port: number;
  /** 호스트 주소 */
  host?: string;
}

/**
 * MCP 서버 시작
 * @returns 서버 인스턴스를 반환하는 Promise
 */
export async function startServer(): Promise<Server> {
  // ...
}
```

**일반 주석 예시**:
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

**스크립트 파일 예시**:
```bash
# 의존성 설치
bun install

# 패키지 빌드
bun run build
```

**원칙**:
- **JSDoc 스타일 (JavaScript/TypeScript)**: 인터페이스, 타입, 함수, 클래스 등은 `/** */` 형식의 JSDoc 주석 사용
- **일반 주석 (JavaScript/TypeScript)**: 간단한 설명이나 인라인 주석은 `//` 형식 사용
- 한글로 작성
- 짧은 주석은 한 줄로 작성
- 긴 설명이 필요한 경우 여러 줄로 나누어 작성 가능
- 코드 자체로 명확한 경우 주석 생략 가능

### 코드 규칙

**주석을 제외한 모든 코드는 영어만 사용합니다.**

- 변수명, 함수명, 클래스명 등 모든 식별자는 영어로 작성
- 문자열 리터럴은 영어로 작성 (사용자에게 표시되는 메시지 제외)
- 에러 메시지, 로그 메시지 등은 영어로 작성

**예시**:
```typescript
// 좋은 예
function updateConnectionState() {
  const clientId = 'client-123';
  console.log('Connection established');
}

// 나쁜 예
function 연결상태업데이트() {
  const 클라이언트ID = 'client-123';
  console.log('연결이 설정되었습니다');
}
```

## 개발 명령어

```bash
# 개발 서버 시작
bun run dev

# 코드 품질
bun run lint                # oxlint
bun run format              # oxfmt

# 테스트
bun run test:unit           # 유닛 테스트
bun run test:coverage       # 커버리지 포함 테스트
```

### 이 레포 PR·push (ohah 전용)

이 레포(ohah/react-native-mcp)에서 push·PR은 **ohah** GitHub 계정을 쓴다.

- **SSH remote**: push가 ohah SSH 키를 쓰도록 origin을 `github.com-private` 로 맞춘다. `~/.ssh/config` 에 `Host github.com-private` 가 ohah용 키를 쓰도록 설정되어 있어야 한다.
  ```bash
  git remote set-url origin git@github.com-private:ohah/react-native-mcp.git
  ```
- **gh**: PR 생성·수정 전에 `gh auth switch --hostname github.com --user ohah` 로 ohah로 전환한다. 작업 후 원래 계정으로 복원한다.

자세한 절차는 `.cursor/commands/init-pr.md`, `.cursor/commands/pr.md` 를 참고한다.

## 커밋 규칙

**중요**: 모든 커밋은 단일 목적에 집중하고, 논리적으로 분리되어야 합니다.

### 커밋 메시지 형식

```
<type>(<scope>): <subject>

<body>

<footer>
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

### Subject (필수)

- **한국어**로 작성
- 50자 이내로 간결하게 작성
- 명령형으로 작성 (과거형 X)
- 마지막에 마침표(.) 사용하지 않음

### Body (선택)

- **한국어**로 작성
- 72자마다 줄바꿈
- 무엇을, 왜 변경했는지 설명
- 어떻게 변경했는지는 코드로 보이므로 생략 가능

### Footer (선택)

- Breaking changes, Issue 번호 등

### 커밋 예시

```
feat(server): MCP 서버 및 도구 지원 추가

- MCP 프로토콜 기반 서버 구현
- 여러 도구(Tool) 등록 및 실행 지원
- 연결 상태 관리 추가
```

```
fix(react-native): WebSocket 재연결 처리 수정

- 연결 끊김 시 재연결 로직 수정
- 지수 백오프 적용
```

### 커밋 원칙

1. **단일 목적**: 하나의 커밋은 하나의 목적만 가져야 함
2. **논리적 분리**: 관련 없는 변경사항은 별도 커밋으로 분리
3. **독립적 의미**: 각 커밋은 독립적으로 의미가 있어야 함
4. **되돌리기 용이**: 특정 기능만 되돌릴 수 있도록 구성
5. **작은 단위**: 가능한 작은 단위로 커밋 (하지만 너무 작지 않게)

### 커밋 순서 예시

1. 의존성 추가
2. 타입 정의
3. 기능 구현
4. 리팩토링
5. 테스트 추가
6. 문서 업데이트

### 커밋 전 필수 작업

**중요**: 커밋하기 전에 반드시 다음 작업을 수행해야 합니다.

도구 버전은 [mise](https://mise.jdx.dev/)로 관리됩니다 (`.mise.toml`). 포맷/린트는 `mise exec --`로 실행하여 프로젝트의 bun을 사용합니다.

1. **코드 포맷팅 검사 및 적용**:
   ```bash
   mise exec -- bun run format
   ```
   - `bun format` 명령어로 코드 포맷팅을 검사하고 자동으로 수정합니다
   - 포맷팅 오류가 있으면 자동으로 수정되므로, 수정된 파일을 함께 커밋해야 합니다
   - 포맷팅 검사를 통과한 후에만 커밋을 진행합니다

2. **린트 검사** (필수):
   ```bash
   mise exec -- bun run lint
   ```
   - `bun lint` 명령어로 코드 품질을 검사합니다
   - 린트 오류가 있으면 수정 후 커밋합니다
   - 린트 검사를 통과한 후에만 커밋을 진행합니다

**커밋 전 체크리스트**:

- [ ] `mise exec -- bun run format` 실행하여 포맷팅 검사 및 수정
- [ ] 포맷팅으로 변경된 파일이 있으면 함께 스테이징
- [ ] `mise exec -- bun run lint` 실행하여 린트 검사
- [ ] 모든 검사를 통과한 후 커밋 진행

## PR 규칙

**언어**: PR 제목, 본문, `branch-summary.md` 모두 **한국어**로 작성한다.

- **제목**: 사용자 지정 시 그대로 사용. 이슈 참조 시 `[#번호]` 접두사 + 주제. 미지정 시 한국어로 짧고 명령형 주제.
- **본문**: `branch-summary.md`를 PR 본문으로 사용. 제목(목적), 작업 내용(산문체) 포함.
- **담당자**: PR 생성 시 `--assignee @me` 추가.
- **라벨**: PR 타입에 맞게 추가 (feat → enhancement, fix → bug, docs → documentation 등).

작업 절차는 `.cursor/commands/pr.md` 참고.
