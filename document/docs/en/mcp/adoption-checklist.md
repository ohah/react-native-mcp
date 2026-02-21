# Adoption checklist

Before adopting React Native MCP, confirm the items below. **Automated checks** can be run with the `doctor` command (similar to React Native doctor).

---

## Automated checks (CI / script)

From your app root (or a directory whose `package.json` includes `react-native`):

```bash
npx @ohah/react-native-mcp-server doctor
```

Or run the script directly:

```bash
node node_modules/@ohah/react-native-mcp-server/scripts/doctor.mjs
```

From inside the package (e.g. monorepo): `bun run doctor`.

**Output**: Sections Common / React Native / E2E with ✓ (pass), ✗ (required fail), ○ (optional / not installed).

- **Success**: When all required checks (Node ≥ 24, react-native ≥ 0.74) pass → "All required checks passed.", exit 0.
- **Failure**: If any required check fails → exit 1. Safe to use in CI.

From the monorepo package:

```bash
cd packages/react-native-mcp-server && bun run doctor
```

(The script reads Node and RN versions from the current directory’s `package.json`.)

---

## Manual checklist

- [ ] **Compatibility**  
       [Compatibility and requirements](compatibility-and-requirements) meet your RN/Expo/Node versions.

- [ ] **Port**  
       MCP server and app default port (12300) is not blocked by firewall or router (local / team network).

- [ ] **Metro**  
       When using MCP, Metro is run with `--config` and your project’s `metro.config.js` (e.g. port 8230). See [Troubleshooting](troubleshooting).

- [ ] **Environment variables**  
       Development: default connection. For MCP in production bundles, run Metro with `REACT_NATIVE_MCP_ENABLED=true` — review security and exposure. See [Expo Guide](expo-guide), [Architecture](architecture).

- [ ] **Security**  
       Only localhost or a restricted network is used. Prefer leaving MCP disabled in production. See [Known limitations and risks](known-limitations-and-risks#risks-security--operations).

- [ ] **E2E (idb/adb)**  
       iOS automation uses idb (macOS); Android uses adb. Ensure they are installed and on PATH. Be aware of touch limitations on physical devices. See [Known limitations](known-limitations-and-risks), idb setup docs.
