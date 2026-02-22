# Compatibility and requirements

Check that your environment meets the requirements below before adopting React Native MCP. For automated checks, use the [adoption checklist](adoption-checklist) doctor script.

---

## Requirements by environment

| Item                    | Requirement                                          | Notes                                                                   |
| ----------------------- | ---------------------------------------------------- | ----------------------------------------------------------------------- |
| **Node**                | ≥ 24                                                 | MCP server runtime. See `engines.node`.                                 |
| **Bun**                 | ≥ 1.0.0 (optional)                                   | Alternative to Node.                                                    |
| **React Native**        | **≥ 0.74** (New Architecture)                        | 0.83.x verified. For Expo, see [Expo Guide](expo-guide).                |
| **New Architecture**    | Supported (min 0.74)                                 | Fabric 0.83.x verified.                                                 |
| **Hermes**              | Assumed                                              | Default React Native engine.                                            |
| **Expo**                | Dev Client ✅ / Expo Go △ / EAS production → MCP off | Details: [Expo Guide](expo-guide).                                      |
| **OS (MCP server)**     | macOS (idb/iOS), Windows/Linux (Android adb)         | iOS simulator automation requires macOS + idb.                          |
| **iOS physical device** | Touch injection not supported                        | Prefer simulator. See [Known limitations](known-limitations-and-risks). |

---

## Version matrix (summary)

| React Native     | Bare / Expo Dev Client | Expo Go          |
| ---------------- | ---------------------- | ---------------- |
| 0.74+ (New Arch) | ✅ Supported           | △ May be limited |
| 0.83.x           | ✅ Verified            | △ Same           |

See [Expo Guide](expo-guide) for the full Expo compatibility table.

---

## Keeping docs and package in sync

When changing requirements, update:

- `packages/react-native-mcp-server/package.json`: `engines`, `peerDependencies`
- Feature roadmap § stability

---

## Reference docs (repository)

Detailed setup and CLI references live in the repo `docs/` folder (not in this site):

- **[idb-setup](https://github.com/ohah/react-native-mcp/blob/main/docs/idb-setup.md)** — idb install and configuration
- **[ADB_REFERENCE](https://github.com/ohah/react-native-mcp/blob/main/docs/ADB_REFERENCE.md)** — adb commands and options
- **[IDB_REFERENCE](https://github.com/ohah/react-native-mcp/blob/main/docs/IDB_REFERENCE.md)** — idb commands and options
- **[e2e-orientation-and-idb-coordinates](https://github.com/ohah/react-native-mcp/blob/main/docs/e2e-orientation-and-idb-coordinates.md)** — E2E orientation and coordinate notes
