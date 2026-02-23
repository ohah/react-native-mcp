# 기술 스택

## 백엔드

- **TypeScript** (MCP 서버)
- **WebSocket** (통신)

## 도구

- **oxlint** / **oxfmt** (코드 품질)
- **mise** (도구 버전 관리)
- **bun** (패키지 매니저 및 런타임)

## YAML/포맷터 규칙 (레포 특징)

YAML 파일의 문자열 인용(id, text 등)은 프로젝트 포맷터(oxfmt)가 **single quote**로 맞춥니다. 이 레포의 일관된 스타일이므로, 리뷰에서 double quote로 통일하라는 제안은 고려하지 않아도 됩니다. 동작은 동일합니다.
