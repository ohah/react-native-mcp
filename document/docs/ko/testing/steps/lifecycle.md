# 앱 생명주기

앱 실행 및 종료 관련 스텝.

## launch

앱을 실행한다. 보통 `setup`에서 사용.

#### Parameters

| 필드 | 타입   | 필수 | 설명                                       |
| ---- | ------ | ---- | ------------------------------------------ |
| (값) | string | ✓    | 번들/패키지 ID. 이 스텝만 문자열 하나로 씀 |

#### Example

```yaml
- launch: org.reactnativemcp.demo
```

---

## terminate

앱을 종료한다. 보통 `teardown`에서 사용.

#### Parameters

| 필드 | 타입   | 필수 | 설명           |
| ---- | ------ | ---- | -------------- |
| (값) | string | ✓    | 번들/패키지 ID |

#### Example

```yaml
- terminate: org.reactnativemcp.demo
```
