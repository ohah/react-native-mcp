# 행동 가이드라인 (AI/에이전트)

AI/에이전트가 코딩할 때 흔한 실수를 줄이기 위한 행동 지침이다.  
[forrestchang/andrej-karpathy-skills](https://github.com/forrestchang/andrej-karpathy-skills)의 [CLAUDE.md](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md)를 기반으로 하며, 프로젝트 규칙과 함께 적용한다.

**트레이드오프:** 속도보다 신중함을 우선한다. 사소한 작업은 판단해서 적용한다.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

- 구현 전에 가정을 명시한다. 불확실하면 묻는다.
- 해석이 여러 가지면 하나만 골라 쓰지 말고 옵션을 제시한다.
- 더 단순한 방법이 있으면 말한다. 필요하면 반론한다.
- 애매하면 멈추고, 무엇이 애매한지 말한 뒤 질문한다.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- 요청된 범위 밖의 기능은 넣지 않는다.
- 한 번만 쓰는 코드에 추상화를 만들지 않는다.
- 요청되지 않은 "유연성"이나 "설정 가능성"을 넣지 않는다.
- 일어날 수 없는 상황용 예외 처리를 하지 않는다.
- 200줄로 쓸 것을 50줄로 쓸 수 있으면 다시 쓴다.

스스로 묻기: "시니어가 과하다고 할까?" 그렇다면 단순화한다.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

기존 코드 수정 시:

- 인접 코드·주석·포맷을 "개선"하지 않는다.
- 깨진 것이 아닌 코드는 리팩터하지 않는다.
- 기존 스타일에 맞춘다 (본인이 다르게 하더라도).
- 관련 없는 죽은 코드를 발견하면 지우지 말고 언급만 한다.

내 변경으로 미사용이 된 것만:

- 내가 만든 미사용 import/변수/함수는 제거한다.
- 원래 있던 죽은 코드는 요청받기 전에는 제거하지 않는다.

검증: 바꾼 모든 줄이 사용자 요청에 직접 대응해야 한다.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

작업을 검증 가능한 목표로 바꾼다:

- "검증 추가" → "잘못된 입력에 대한 테스트를 쓰고, 통과시킨다"
- "버그 수정" → "재현 테스트를 쓰고, 통과시킨다"
- "X 리팩터" → "리팩터 전후로 테스트가 통과하는지 확인한다"

여러 단계 작업은 짧은 계획을 세운다:

1. [단계] → 검증: [체크]
2. [단계] → 검증: [체크]
3. [단계] → 검증: [체크]

명확한 성공 기준이 있으면 스스로 반복할 수 있다. 모호한 기준("돌아가게 해줘")은 계속 확인이 필요하다.

---

**이 가이드가 잘 적용되면:** 불필요한 diff 감소, 과한 구현으로 인한 재작성 감소, 실수 후가 아니라 구현 전에 질문이 나온다.
