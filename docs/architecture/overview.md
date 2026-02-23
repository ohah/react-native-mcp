# 개요

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
- **컴포넌트 → 소스 위치 조회** (`get_component_source`): selector 또는 uid로 컴포넌트를 지정하면 해당 컴포넌트의 원본 파일·라인을 반환. "StepLayout 수정해줘"처럼 컴포넌트 기준 요청 시 코드베이스 검색 없이 바로 해당 위치로 이동해 수정할 수 있어 토큰 절약에 유리함.

## 패키지 구조

```
react-native-mcp/
├── packages/
│   └── react-native-mcp-server/   # MCP 서버 (Babel preset·도구·metro-cdp 포함)
├── examples/
│   └── demo-app/                  # 테스트용 RN 앱
├── editor/
│   └── vscode/                    # VS Code 확장
├── document/                      # rspress 기반 사용자 문서
├── docs/                          # 내부 개발 문서
└── scripts/                       # 빌드/개발 스크립트
```

> 사용자 대상 상세 아키텍처 문서는 [rspress](../../document/docs/ko/mcp/architecture.md) 참고.
