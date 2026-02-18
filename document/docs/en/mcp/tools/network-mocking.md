# Network Mocking

Tools for mocking API responses without modifying your backend. Matched XHR/fetch requests return the mock response directly.

## set_network_mock

Add a network mock rule. Matching requests will return the mocked response without hitting the network.

#### Parameters

| Parameter    | Type                 | Required | Description                                                           |
| ------------ | -------------------- | -------- | --------------------------------------------------------------------- |
| `urlPattern` | `string`             | **Yes**  | URL pattern to match (substring or regex)                             |
| `isRegex`    | `boolean`            | No       | Set `true` if `urlPattern` is a regex                                 |
| `method`     | `string`             | No       | HTTP method filter. Omit to match all methods                         |
| `status`     | `number`             | No       | Mock response status code. Default: `200`                             |
| `statusText` | `string`             | No       | Mock response status text                                             |
| `headers`    | `object`             | No       | Mock response headers. e.g., `{ "Content-Type": "application/json" }` |
| `body`       | `string`             | No       | Mock response body                                                    |
| `delay`      | `number`             | No       | Delay in ms before returning the mock response                        |
| `platform`   | `"ios" \| "android"` | No       | Target platform                                                       |
| `deviceId`   | `string`             | No       | Target device                                                         |

#### Example

```json
// Mock a successful API response
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/users",
    "method": "GET",
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"users\":[{\"id\":1,\"name\":\"Alice\"}]}"
  }
}

// Simulate a server error
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/checkout",
    "method": "POST",
    "status": 500,
    "body": "{\"error\":\"Internal server error\"}"
  }
}

// Simulate slow network (2 second delay)
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/products",
    "delay": 2000,
    "body": "{\"products\":[]}"
  }
}

// Regex pattern matching
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/users/\\d+",
    "isRegex": true,
    "body": "{\"id\":1,\"name\":\"Mock User\"}"
  }
}

// Response
{ "id": 1, "urlPattern": "/api/users", "status": 200, "enabled": true }
```

#### Tips

- Mocks intercept both `fetch()` and `XMLHttpRequest` calls.
- Substring matching is the default. Use `isRegex: true` for complex patterns.
- Mocks persist until explicitly removed or cleared.
- The `body` must be a string. For JSON responses, stringify the object.

---

## list_network_mocks

List all active network mock rules.

#### Parameters

| Parameter  | Type                 | Required | Description     |
| ---------- | -------------------- | -------- | --------------- |
| `platform` | `"ios" \| "android"` | No       | Target platform |
| `deviceId` | `string`             | No       | Target device   |

#### Example

```json
// Request
{ "tool": "list_network_mocks" }

// Response
[
  { "id": 1, "urlPattern": "/api/users", "isRegex": false, "method": "GET", "status": 200, "enabled": true, "hitCount": 3 },
  { "id": 2, "urlPattern": "/api/checkout", "isRegex": false, "method": "POST", "status": 500, "enabled": true, "hitCount": 0 }
]
```

#### Tips

- `hitCount` shows how many requests matched each mock — useful for verifying your mock was triggered.

---

## remove_network_mock

Remove a specific network mock rule by its ID.

#### Parameters

| Parameter  | Type                 | Required | Description                                                                       |
| ---------- | -------------------- | -------- | --------------------------------------------------------------------------------- |
| `id`       | `number`             | **Yes**  | Mock rule ID to remove (from `list_network_mocks` or `set_network_mock` response) |
| `platform` | `"ios" \| "android"` | No       | Target platform                                                                   |
| `deviceId` | `string`             | No       | Target device                                                                     |

#### Example

```json
{ "tool": "remove_network_mock", "arguments": { "id": 1 } }
```

---

## clear_network_mocks

Remove all active network mock rules at once.

#### Parameters

| Parameter  | Type                 | Required | Description     |
| ---------- | -------------------- | -------- | --------------- |
| `platform` | `"ios" \| "android"` | No       | Target platform |
| `deviceId` | `string`             | No       | Target device   |

#### Example

```json
{ "tool": "clear_network_mocks" }
```

#### Tips

- Call after a test scenario to ensure mocks don't leak into subsequent tests.
