---
description: 32가지 E2E YAML 스텝 타입(탭, 검증, 대기, 내비게이션 등) 레퍼런스. 문법 및 셀렉터 규칙.
---

# 스텝 레퍼런스

E2E YAML 러너는 7개 카테고리에 걸쳐 **32가지 스텝 타입**을 지원한다. 각 스텝은 하나의 동작(탭, 검증, 대기, 내비게이션 등)을 수행한다.

## 스텝 문법

스텝 항목당 키를 **정확히 하나**만 사용한다. 대부분의 스텝은 파라미터 객체를 받으며, 일부(`wait`, `launch`, `terminate`, `clearState`)는 스칼라 값 하나만 받는다.

```yaml
# 객체 형식
- tap:
    selector: '#submit-button'

# 스칼라 형식
- wait: 500
```

## 셀렉터 문법

`selector` 필드를 받는 스텝은 MCP 도구와 동일한 쿼리 문법을 사용한다:

| 패턴        | 예시                           | 설명                   |
| ----------- | ------------------------------ | ---------------------- |
| testID      | `#submit-btn`                  | testID prop으로 매칭   |
| Type        | `Text`                         | 컴포넌트 타입으로 매칭 |
| Text        | `:text("Hello")`               | 텍스트 내용으로 매칭   |
| Attribute   | `[accessibilityLabel="Close"]` | prop 값으로 매칭       |
| displayName | `:display-name("MyComponent")` | display name으로 매칭  |
| Index       | `:nth-of-type(2)`              | N번째 요소 매칭        |
| Capability  | `:has-press`                   | 터치 가능한 요소       |
| Hierarchy   | `ScrollView > View > Text`     | 직계 자식 또는 자손    |
| OR          | `#btn-a, #btn-b`               | 둘 중 하나 매칭        |

## 카테고리

| 카테고리                              | 스텝 수 | 설명                                           |
| ------------------------------------- | ------- | ---------------------------------------------- |
| [인터랙션](./interaction)             | 8       | 탭, 스와이프, 텍스트 입력, 길게 누르기, 스크롤 |
| [검증](./assertions)                  | 5       | 텍스트, 가시성, 요소 개수, 값 검증             |
| [대기](./waits)                       | 4       | 텍스트, 가시성, 고정 시간 대기                 |
| [내비게이션 & 디바이스](./navigation) | 7       | 버튼, 뒤로, 홈, 딥링크, 위치, 초기화           |
| [앱 생명주기](./lifecycle)            | 2       | 앱 실행 및 종료                                |
| [스크린샷](./screenshots)             | 2       | 스크린샷 캡처 및 비교                          |
| [유틸리티](./utilities)               | 4       | 텍스트 복사·붙여넣기, JS 실행, 미디어 추가     |
