# 스크린샷

스크린샷 캡처 및 비교 관련 스텝.

## screenshot

스크린샷을 저장한다.

#### Parameters

| 필드 | 타입   | 필수 | 설명                              |
| ---- | ------ | ---- | --------------------------------- |
| path | string |      | 저장 경로. 생략 시 기본 경로 사용 |

#### Example

```yaml
- screenshot:
    path: './results/step1.png'
```

---

## compareScreenshot

현재 스크린샷을 베이스라인 PNG 이미지와 비교한다. selector를 지정하면 해당 요소만 크롭하여 컴포넌트 단위 비주얼 리그레션 테스트가 가능하다.

#### Parameters

| 필드      | 타입    | 필수 | 설명                                                       |
| --------- | ------- | ---- | ---------------------------------------------------------- |
| baseline  | string  | ✓    | 베이스라인 PNG 경로 (YAML 파일 기준 상대경로)              |
| selector  | string  |      | 특정 요소만 크롭할 CSS-like 셀렉터. 생략 시 전체 화면 비교 |
| threshold | number  |      | pixelmatch 임계값 (0~1). 기본 0.01                         |
| update    | boolean |      | true이면 현재 스크린샷을 베이스라인으로 저장 (비교 생략)   |

#### Example

```yaml
# 전체 화면 비교
- compareScreenshot:
    baseline: ./baselines/home-screen.png
    threshold: 0.01

# 컴포넌트 단위 비교
- compareScreenshot:
    baseline: ./baselines/counter-button.png
    selector: 'Pressable:text("Count:")'
    threshold: 0.005

# 베이스라인 갱신 (현재 상태를 베이스라인으로 저장)
- compareScreenshot:
    baseline: ./baselines/home-screen.png
    update: true
```

#### Tips

1. `update: true`로 실행하여 베이스라인을 생성 → Git에 커밋.
2. `update` 없이 실행하여 현재 상태와 베이스라인을 비교.
3. 실패 시 diff 이미지가 출력 디렉터리에 저장된다. HTML 리포터에서 diff를 인라인으로 표시.
