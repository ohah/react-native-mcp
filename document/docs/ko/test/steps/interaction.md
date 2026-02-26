# 인터랙션

탭, 스와이프, 텍스트 입력, 스크롤 관련 스텝.

## tap

요소를 한 번 탭한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| selector | string | ✓    | 탭할 요소 셀렉터 |

#### Example

```yaml
- tap:
    selector: '#submit-button'
```

#### Tips

- **iOS**: 4가지 orientation 모두 지원 (Portrait, Portrait180, LandscapeA, LandscapeB). `xcrun simctl spawn`으로 자동 감지하거나 `config.orientation`으로 강제 지정.
- **Android**: orientation 보정 없이 동작.

---

## swipe

요소 위에서 스와이프한다.

#### Parameters

| 필드      | 타입             | 필수 | 설명                                                                                      |
| --------- | ---------------- | ---- | ----------------------------------------------------------------------------------------- |
| selector  | string           | ✓    | 대상 요소 셀렉터                                                                          |
| direction | string           | ✓    | `up` \| `down` \| `left` \| `right`                                                       |
| distance  | number \| string |      | 스와이프 거리. 숫자면 dp, `'50%'`처럼 문자열이면 요소 크기 대비 비율. 생략 시 기본값 사용 |

#### Example

```yaml
- swipe:
    selector: '#list'
    direction: up
    distance: 200 # 절대값 200dp
- swipe:
    selector: '#carousel'
    direction: left
    distance: '80%' # 요소 너비의 80%
```

---

## typeText

요소에 텍스트를 입력한다(기존 내용 대체).

#### Parameters

| 필드     | 타입   | 필수 | 설명             |
| -------- | ------ | ---- | ---------------- |
| selector | string | ✓    | 입력 대상 셀렉터 |
| text     | string | ✓    | 입력할 문자열    |

#### Example

```yaml
- typeText:
    selector: '#email'
    text: user@example.com
```

---

## inputText

현재 포커스된 필드에 텍스트를 입력한다.

#### Parameters

| 필드 | 타입   | 필수 | 설명          |
| ---- | ------ | ---- | ------------- |
| text | string | ✓    | 입력할 문자열 |

#### Example

```yaml
- inputText:
    text: Hello
```

---

## longPress

요소를 길게 누른다. `tap` + `duration` 래핑으로, YAML 가독성을 위한 별도 스텝.

#### Parameters

| 필드     | 타입   | 필수 | 설명                      |
| -------- | ------ | ---- | ------------------------- |
| selector | string | ✓    | 길게 누를 요소 셀렉터     |
| duration | number |      | 누르는 시간(ms). 기본 800 |

#### Example

```yaml
- longPress:
    selector: '#item-3'
    duration: 1000
```

---

## doubleTap

요소를 빠르게 두 번 탭한다.

#### Parameters

| 필드     | 타입   | 필수 | 설명                         |
| -------- | ------ | ---- | ---------------------------- |
| selector | string | ✓    | 탭할 요소 셀렉터             |
| interval | number |      | 두 탭 사이 간격(ms). 기본 50 |

#### Example

```yaml
- doubleTap:
    selector: '#zoomable-image'
    interval: 100
```

---

## clearText

TextInput의 텍스트를 전부 지운다.

#### Parameters

| 필드     | 타입   | 필수 | 설명                  |
| -------- | ------ | ---- | --------------------- |
| selector | string | ✓    | 대상 TextInput 셀렉터 |

#### Example

```yaml
- clearText:
    selector: '#email'
```

---

## scrollUntilVisible

스크롤하여 요소가 보일 때까지 반복한다.

#### Parameters

| 필드               | 타입   | 필수 | 설명                                                   |
| ------------------ | ------ | ---- | ------------------------------------------------------ |
| selector           | string | ✓    | 보이게 할 요소 셀렉터                                  |
| scrollableSelector | string |      | 스크롤할 컨테이너 셀렉터. 생략 시 화면 전체를 스와이프 |
| direction          | string |      | `up` \| `down` \| `left` \| `right`. 기본 `down`       |
| maxScrolls         | number |      | 최대 스크롤 횟수. 초과 시 실패                         |

#### Example

```yaml
- scrollUntilVisible:
    selector: '#footer'
    direction: down
    maxScrolls: 10

# 특정 ScrollView 내에서만 스크롤
- scrollUntilVisible:
    selector: '#bottom-navigation-badge'
    scrollableSelector: '#content-scroll-tablet'
    direction: down
    maxScrolls: 3
```
