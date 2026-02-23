# 코딩 스타일 가이드라인

## 주석 규칙

모든 주석은 **한글**로 작성합니다.

### JavaScript/TypeScript 주석

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

## 코드 규칙

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
