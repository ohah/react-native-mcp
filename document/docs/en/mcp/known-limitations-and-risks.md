# Known limitations and risks

This page summarizes limitations and risks before adopting React Native MCP. For technical details, follow the links in each row.

---

## Limitations summary

| Limitation                  | Description                                                               | Workaround / recommendation                                                                  |
| --------------------------- | ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| **iOS physical device**     | idb/simctl touch injection not supported                                  | Use XCTest/WDA or MCP `type_text`. See idb setup docs.                                       |
| **Android physical device** | If localhost is not the host, app cannot reach port 12300 (runtime limit) | Use emulator or port forwarding. See troubleshooting.                                        |
| **Korean input (idb)**      | `idb ui text "한글"` may crash the app                                    | Use MCP `type_text`. See idb setup.                                                          |
| **Multi-touch**             | idb/adb support single touch only                                         | Pinch/rotate not supported.                                                                  |
| **Expo Go**                 | localhost WebSocket may be restricted                                     | Prefer Expo Dev Client. See [Expo Guide](expo-guide).                                        |
| **Production**              | MCP runtime is off by default                                             | Enable only when needed with env (e.g. `REACT_NATIVE_MCP_ENABLED=true`) and review security. |
| **FlatList virtualized**    | Virtualized items are not in the snapshot                                 | Use `scroll_until_visible` then query.                                                       |
| **WebView**                 | idb describe-all does not show WebView contents                           | Prefer `webview_evaluate_script`.                                                            |
| **iPad HID**                | Return(40) can trigger multitasking                                       | Check per app. See idb setup.                                                                |

---

## Risks (security and operations)

- **Security**: The MCP runtime assumes localhost-only use. Prefer leaving it disabled in production; if enabled, review port and network exposure.
- **Operations**: Health check (GET /health) and simple metrics (GET /metrics) are provided. See [Observability](observability). Additional metrics (request count, latency) may be added in a future roadmap.
