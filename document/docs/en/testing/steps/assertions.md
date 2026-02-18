# Assertions

Steps for verifying text content, element visibility, element count, and values. Assertion failures cause the step to fail immediately.

## assertText

Assert that the text is present (within the element when selector is given).

#### Parameters

| Field    | Type   | Required | Description    |
| -------- | ------ | -------- | -------------- |
| text     | string | Yes      | Expected text  |
| selector | string | No       | Scope selector |

#### Example

```yaml
- assertText:
    text: 'Saved'
    selector: '#status'
```

---

## assertVisible

Assert that the element is visible.

#### Parameters

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | Yes      | Element selector |

#### Example

```yaml
- assertVisible:
    selector: '#main-form'
```

---

## assertNotVisible

Assert that the element is not visible.

#### Parameters

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | Yes      | Element selector |

#### Example

```yaml
- assertNotVisible:
    selector: '#error-banner'
```

---

## assertCount

Assert that the number of elements matching the selector equals the expected count.

#### Parameters

| Field    | Type   | Required | Description       |
| -------- | ------ | -------- | ----------------- |
| selector | string | Yes      | Selector to count |
| count    | number | Yes      | Expected count    |

#### Example

```yaml
- assertCount:
    selector: ':has-press'
    count: 5
```

---

## assertHasText

Assert that the text is present (within the element when selector is given). Alias for `assertText`.

#### Parameters

| Field    | Type   | Required | Description    |
| -------- | ------ | -------- | -------------- |
| text     | string | Yes      | Expected text  |
| selector | string | No       | Scope selector |

#### Example

```yaml
- assertHasText:
    text: 'Total: $12.00'
    selector: '#price-label'
```

---

## assertValue

Assert that the element's `value` prop matches the expected string.

#### Parameters

| Field    | Type   | Required | Description      |
| -------- | ------ | -------- | ---------------- |
| selector | string | Yes      | Element selector |
| expected | string | Yes      | Expected value   |

#### Example

```yaml
- assertValue:
    selector: '#quantity-input'
    expected: '3'
```
