# App Lifecycle

Steps for launching and terminating the app.

## launch

Launch the app. Usually used in `setup`.

#### Parameters

| Field   | Type   | Required | Description                                      |
| ------- | ------ | -------- | ------------------------------------------------ |
| (value) | string | Yes      | Bundle/package ID. This step is a single string. |

#### Example

```yaml
- launch: org.reactnativemcp.demo
```

---

## terminate

Terminate the app. Usually used in `teardown`.

#### Parameters

| Field   | Type   | Required | Description       |
| ------- | ------ | -------- | ----------------- |
| (value) | string | Yes      | Bundle/package ID |

#### Example

```yaml
- terminate: org.reactnativemcp.demo
```
