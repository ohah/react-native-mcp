# 대기

조건이 충족될 때까지 또는 고정 시간 대기하는 스텝.

## waitForText

지정한 텍스트가 나타날 때까지 대기한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명                          |
| -------- | ------ | ---- | ----------------------------- |
| text     | string | ✓    | 기대하는 텍스트               |
| timeout  | number |      | 대기 시간(ms). 생략 시 기본값 |
| selector | string |      | 텍스트를 찾을 범위 셀렉터     |
| interval | number |      | 폴링 간격(ms). 기본 300       |

#### Example

```yaml
- waitForText:
    text: 'Count: 1'
    timeout: 3000
    selector: '#counter'
```

---

## waitForVisible

요소가 보일 때까지 대기한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명                    |
| -------- | ------ | ---- | ----------------------- |
| selector | string | ✓    | 대기할 요소 셀렉터      |
| timeout  | number |      | 대기 시간(ms)           |
| interval | number |      | 폴링 간격(ms). 기본 300 |

#### Example

```yaml
- waitForVisible:
    selector: '#loaded-view'
    timeout: 5000
```

---

## waitForNotVisible

요소가 사라질 때까지 대기한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명                    |
| -------- | ------ | ---- | ----------------------- |
| selector | string | ✓    | 사라질 요소 셀렉터      |
| timeout  | number |      | 대기 시간(ms)           |
| interval | number |      | 폴링 간격(ms). 기본 300 |

#### Example

```yaml
- waitForNotVisible:
    selector: '#spinner'
    timeout: 3000
```

---

## wait

고정 시간(ms) 대기한다.

#### Parameters

| 필드 | 타입   | 필수 | 설명                                    |
| ---- | ------ | ---- | --------------------------------------- |
| (값) | number | ✓    | 대기 시간(ms). 이 스텝만 숫자 하나로 씀 |

#### Example

```yaml
- wait: 500
```
