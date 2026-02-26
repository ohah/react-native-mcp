# 검증

텍스트, 요소 가시성, 요소 개수, 값을 검증하는 스텝. 검증 실패 시 스텝이 즉시 실패한다.

## assertText

텍스트가 (선택 시 해당 요소에) 있는지 검증한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| text     | string | ✓    | 기대하는 텍스트  |
| selector | string |      | 검사 범위 셀렉터 |

#### Example

```yaml
- assertText:
    text: '저장됨'
    selector: '#status'
```

---

## assertVisible

요소가 보이는지 검증한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 검사할 요소 셀렉터 |

#### Example

```yaml
- assertVisible:
    selector: '#main-form'
```

---

## assertNotVisible

요소가 보이지 않는지 검증한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 검사할 요소 셀렉터 |

#### Example

```yaml
- assertNotVisible:
    selector: '#error-banner'
```

---

## assertCount

셀렉터에 매칭되는 요소 개수가 조건에 맞는지 검증한다. `count`로 정확한 값을, `minCount`/`maxCount`로 범위를 검사할 수 있다.

#### Parameters

| 필드     | 타입   | 필수 | 설명                  |
| -------- | ------ | ---- | --------------------- |
| selector | string | ✓    | 개수를 셀 요소 셀렉터 |
| count    | number |      | 정확한 기대 개수      |
| minCount | number |      | 최소 개수 (이상)      |
| maxCount | number |      | 최대 개수 (이하)      |

`count`, `minCount`, `maxCount` 중 하나 이상 필수.

#### Example

```yaml
# 정확한 개수 검증
- assertCount:
    selector: ':has-press'
    count: 5

# 범위 검증
- assertCount:
    selector: '.list-item'
    minCount: 1
    maxCount: 10
```

---

## assertValue

TextInput 등의 `value` prop이 기대값과 일치하는지 검증한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명               |
| -------- | ------ | ---- | ------------------ |
| selector | string | ✓    | 검사할 요소 셀렉터 |
| expected | string | ✓    | 기대하는 값        |

#### Example

```yaml
- assertValue:
    selector: '#quantity-input'
    expected: '3'
```
