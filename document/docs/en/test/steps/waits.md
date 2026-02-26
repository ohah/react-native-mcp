# Waits

Steps for waiting until conditions are met or a fixed delay has elapsed.

## waitForText

Wait until the given text appears.

#### Parameters

| Field    | Type   | Required | Description                                |
| -------- | ------ | -------- | ------------------------------------------ |
| text     | string | Yes      | Expected text                              |
| timeout  | number | No       | Wait time (ms). Default if omitted         |
| selector | string | No       | Scope selector for text                    |
| interval | number | No       | Polling interval (ms). Default 300         |

#### Example

```yaml
- waitForText:
    text: 'Count: 1'
    timeout: 3000
    selector: '#counter'
```

---

## waitForVisible

Wait until the element is visible.

#### Parameters

| Field    | Type   | Required | Description                        |
| -------- | ------ | -------- | ---------------------------------- |
| selector | string | Yes      | Element selector                   |
| timeout  | number | No       | Wait time (ms)                     |
| interval | number | No       | Polling interval (ms). Default 300 |

#### Example

```yaml
- waitForVisible:
    selector: '#loaded-view'
    timeout: 5000
```

---

## waitForNotVisible

Wait until the element is not visible.

#### Parameters

| Field    | Type   | Required | Description                        |
| -------- | ------ | -------- | ---------------------------------- |
| selector | string | Yes      | Element selector                   |
| timeout  | number | No       | Wait time (ms)                     |
| interval | number | No       | Polling interval (ms). Default 300 |

#### Example

```yaml
- waitForNotVisible:
    selector: '#spinner'
    timeout: 3000
```

---

## wait

Fixed delay in ms.

#### Parameters

| Field   | Type   | Required | Description                         |
| ------- | ------ | -------- | ----------------------------------- |
| (value) | number | Yes      | Delay in ms. This step is a scalar. |

#### Example

```yaml
- wait: 500
```
