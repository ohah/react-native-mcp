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

Assert that the number of elements matching the selector meets the expected condition. Provide `count` for exact match, or `minCount`/`maxCount` for range checks.

#### Parameters

| Field    | Type   | Required | Description               |
| -------- | ------ | -------- | ------------------------- |
| selector | string | Yes      | Selector to count         |
| count    | number | No       | Exact expected count      |
| minCount | number | No       | Minimum count (inclusive) |
| maxCount | number | No       | Maximum count (inclusive) |

At least one of `count`, `minCount`, or `maxCount` must be provided.

#### Example

```yaml
# Exact count
- assertCount:
    selector: ':has-press'
    count: 5

# Range check
- assertCount:
    selector: '.list-item'
    minCount: 1
    maxCount: 10
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
