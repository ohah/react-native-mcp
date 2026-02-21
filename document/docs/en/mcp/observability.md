# Observability

Ways to check MCP server status and troubleshoot issues.

---

## Health check

While the server process is running, an **HTTP health server** runs on a separate port.

- **Default port**: 12301 (separate from WebSocket 12300)
- **Environment variable**: `REACT_NATIVE_MCP_HEALTH_PORT` to change port. Set to `0` to disable.

### Endpoints

| Path                                 | Description                  | Example response                                                       |
| ------------------------------------ | ---------------------------- | ---------------------------------------------------------------------- |
| `GET http://127.0.0.1:12301/health`  | Server and connection status | `{ "ok": true, "wsPort": 12300, "hasServer": true, "deviceCount": 1 }` |
| `GET http://127.0.0.1:12301/metrics` | Simple metrics               | `{ "deviceCount": 1, "connected": true }`                              |

Use `/health` for liveness/readiness probes in load balancers or container orchestration.

---

## Metrics

- **deviceCount**: Number of connected app (device) connections.
- **connected**: Whether at least one device is connected.

Additional metrics (request count, latency, etc.) may be added in a future roadmap.

---

## Logging

The server logs briefly to stderr (e.g. WebSocket listening, client connected/disconnected, stdio running). Structured logging (JSON, log levels) is not provided.
