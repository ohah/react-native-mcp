# Network Mocking

A step-by-step workflow for mocking API responses, simulating error conditions, and verifying the app handles them correctly.

## Scenario

You want to test how your app behaves when the API returns errors or slow responses, without modifying the backend.

## Step 1: Clear existing state

Start clean by clearing any existing mocks and network logs.

```json
{ "tool": "clear_network_mocks" }
{ "tool": "clear_network_requests" }
```

## Step 2: Mock a successful response

Set up a mock for the user profile endpoint.

```json
{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/user/profile",
    "method": "GET",
    "status": 200,
    "headers": { "Content-Type": "application/json" },
    "body": "{\"id\":1,\"name\":\"Test User\",\"email\":\"test@example.com\"}"
  }
}
```

Navigate to the profile screen and verify the mock data is displayed:

```json
{ "tool": "assert_text", "arguments": { "text": "Test User", "timeoutMs": 3000 } }
```

## Step 3: Simulate a server error

Remove the success mock and add an error mock.

```json
{ "tool": "clear_network_mocks" }

{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/user/profile",
    "method": "GET",
    "status": 500,
    "body": "{\"error\":\"Internal server error\"}"
  }
}
```

Trigger a refresh and verify error handling:

```json
{ "tool": "assert_text", "arguments": { "text": "Something went wrong", "timeoutMs": 3000 } }
```

## Step 4: Simulate slow network

Test loading states by adding a delay.

```json
{ "tool": "clear_network_mocks" }

{
  "tool": "set_network_mock",
  "arguments": {
    "urlPattern": "/api/user/profile",
    "delay": 3000,
    "body": "{\"id\":1,\"name\":\"Test User\"}"
  }
}
```

Trigger the request and verify the loading indicator appears:

```json
{ "tool": "assert_visible", "arguments": { "selector": "#loading-spinner", "timeoutMs": 1000 } }
```

Then wait for it to disappear:

```json
{ "tool": "assert_not_visible", "arguments": { "selector": "#loading-spinner", "timeoutMs": 5000 } }
```

## Step 5: Verify mock hit counts

Check that your mocks were actually triggered.

```json
{ "tool": "list_network_mocks" }
```

**Example response:**

```json
[{ "id": 3, "urlPattern": "/api/user/profile", "status": 200, "hitCount": 1, "enabled": true }]
```

`hitCount: 1` confirms the mock was triggered exactly once.

## Step 6: Inspect actual network traffic

Check the captured network requests for debugging.

```json
{
  "tool": "list_network_requests",
  "arguments": { "url": "/api/user", "limit": 5 }
}
```

## Step 7: Clean up

Always clean up mocks after testing.

```json
{ "tool": "clear_network_mocks" }
```

## Summary

| Step | Tool                            | Purpose                |
| ---- | ------------------------------- | ---------------------- |
| 1    | `clear_network_mocks`           | Start clean            |
| 2    | `set_network_mock`              | Mock success response  |
| 3    | `set_network_mock` (status 500) | Simulate error         |
| 4    | `set_network_mock` (delay)      | Simulate slow network  |
| 5    | `list_network_mocks`            | Verify mock hit counts |
| 6    | `list_network_requests`         | Inspect actual traffic |
| 7    | `clear_network_mocks`           | Clean up               |
