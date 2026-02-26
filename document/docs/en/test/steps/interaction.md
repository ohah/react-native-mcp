# Interaction

Steps for tapping, swiping, typing text, and scrolling elements.

## tap

Tap the element once.

#### Parameters

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | Yes      | Element selector |

#### Example

```yaml
- tap:
    selector: '#submit-button'
```

#### Tips

- **iOS**: All 4 orientations supported (Portrait, Portrait180, LandscapeA, LandscapeB). Auto-detected via `xcrun simctl spawn` or forced with `config.orientation`.
- **Android**: No orientation correction needed.

---

## swipe

Swipe on the element.

#### Parameters

| Field     | Type             | Required | Description                                                                                           |
| --------- | ---------------- | -------- | ----------------------------------------------------------------------------------------------------- |
| selector  | string           | Yes      | Target element selector                                                                               |
| direction | string           | Yes      | `up` \| `down` \| `left` \| `right`                                                                   |
| distance  | number \| string | No       | Swipe distance. Number for dp, string like `'50%'` for percentage of element size. Default if omitted |

#### Example

```yaml
- swipe:
    selector: '#list'
    direction: up
    distance: 200 # absolute 200dp
- swipe:
    selector: '#carousel'
    direction: left
    distance: '80%' # 80% of element width
```

---

## typeText

Type text into the element (replaces existing content).

#### Parameters

| Field    | Type   | Required | Description           |
| -------- | ------ | -------- | --------------------- |
| selector | string | Yes      | Input target selector |
| text     | string | Yes      | String to type        |

#### Example

```yaml
- typeText:
    selector: '#email'
    text: user@example.com
```

---

## inputText

Type text into the currently focused field.

#### Parameters

| Field | Type   | Required | Description    |
| ----- | ------ | -------- | -------------- |
| text  | string | Yes      | String to type |

#### Example

```yaml
- inputText:
    text: Hello
```

---

## longPress

Long-press an element. Wraps `tap` + `duration` for readability.

#### Parameters

| Field    | Type   | Required | Description                      |
| -------- | ------ | -------- | -------------------------------- |
| selector | string | Yes      | Element to long-press            |
| duration | number | No       | Press duration (ms). Default 800 |

#### Example

```yaml
- longPress:
    selector: '#item-3'
    duration: 1000
```

---

## doubleTap

Double-tap the element.

#### Parameters

| Field    | Type   | Required | Description                         |
| -------- | ------ | -------- | ----------------------------------- |
| selector | string | Yes      | Element selector                    |
| interval | number | No       | Delay between taps (ms). Default 50 |

#### Example

```yaml
- doubleTap:
    selector: '#zoomable-image'
    interval: 100
```

---

## clearText

Clear all text from a TextInput.

#### Parameters

| Field    | Type   | Required | Description               |
| -------- | ------ | -------- | ------------------------- |
| selector | string | Yes      | Target TextInput selector |

#### Example

```yaml
- clearText:
    selector: '#email'
```

---

## scrollUntilVisible

Scroll until the element is visible (repeat up to limit).

#### Parameters

| Field              | Type   | Required | Description                                              |
| ------------------ | ------ | -------- | -------------------------------------------------------- |
| selector           | string | Yes      | Element to make visible                                  |
| scrollableSelector | string | No       | Scrollable container selector. Swipes full screen if omitted |
| direction          | string | No       | `up` \| `down` \| `left` \| `right`. Default `down`      |
| maxScrolls         | number | No       | Max scrolls. Fails if exceeded                           |

#### Example

```yaml
- scrollUntilVisible:
    selector: '#footer'
    direction: down
    maxScrolls: 10

# Scroll within a specific ScrollView
- scrollUntilVisible:
    selector: '#bottom-navigation-badge'
    scrollableSelector: '#content-scroll-tablet'
    direction: down
    maxScrolls: 3
```
