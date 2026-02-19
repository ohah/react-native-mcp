# Console & Network

Tools for inspecting captured console logs and network requests from the app.

## list_console_messages

List captured `console.log/info/warn/error` messages from the app.

#### Parameters

| Parameter  | Type                                   | Required | Description                                  |
| ---------- | -------------------------------------- | -------- | -------------------------------------------- |
| `level`    | `"log" \| "info" \| "warn" \| "error"` | No       | Filter by log level. Omit for all levels     |
| `since`    | `number`                               | No       | Only return logs after this timestamp (ms)   |
| `limit`    | `number`                               | No       | Max number of logs to return. Default: `100` |
| `platform` | `"ios" \| "android"`                   | No       | Target platform                              |
| `deviceId` | `string`                               | No       | Target device                                |

#### Example

```json
// Get all error logs
{
  "tool": "list_console_messages",
  "arguments": { "level": "error" }
}

// Get recent logs (last 5 seconds)
{
  "tool": "list_console_messages",
  "arguments": { "since": 1700000000000, "limit": 20 }
}

// Response
[
  { "id": 1, "level": "error", "message": "Network request failed: timeout", "timestamp": 1700000001234 },
  { "id": 2, "level": "warn", "message": "Deprecated API usage", "timestamp": 1700000001500 }
]
```

#### Tips

- Console messages are buffered in the MCP server. Use `since` to get only new messages since your last check.
- Combine with `clear` (target: `console`) to reset the buffer before a test scenario.

---

## list_network_requests

List captured XHR/fetch requests with request and response details.

#### Parameters

| Parameter  | Type                 | Required | Description                                    |
| ---------- | -------------------- | -------- | ---------------------------------------------- |
| `url`      | `string`             | No       | URL substring filter                           |
| `method`   | `string`             | No       | HTTP method filter (e.g., `GET`, `POST`)       |
| `status`   | `number`             | No       | Status code filter (e.g., `200`, `404`)        |
| `since`    | `number`             | No       | Only return requests after this timestamp (ms) |
| `limit`    | `number`             | No       | Max number of requests. Default: `50`          |
| `platform` | `"ios" \| "android"` | No       | Target platform                                |
| `deviceId` | `string`             | No       | Target device                                  |

#### Example

```json
// Filter by URL
{
  "tool": "list_network_requests",
  "arguments": { "url": "/api/users" }
}

// Filter by method and status
{
  "tool": "list_network_requests",
  "arguments": { "method": "POST", "status": 201 }
}

// Response
[
  {
    "id": 1,
    "method": "GET",
    "url": "https://api.example.com/api/users",
    "status": 200,
    "statusText": "OK",
    "duration": 245,
    "state": "completed",
    "requestBody": null,
    "responseBody": "{\"users\":[...]}"
  }
]
```

#### Tips

- Captures both `fetch()` and `XMLHttpRequest` calls.
- Use `url` filter to narrow down results — it matches as a substring.
- `responseBody` is captured as a string. Large responses may be truncated.

- Use `clear` (target: `network_requests`) to empty the buffer before a test scenario.
