# Expo Guide

React Native MCP works with Expo projects. The runtime is pure JavaScript, and Expo uses the same Hermes runtime.

> **Quick setup**: Run `npx -y @ohah/react-native-mcp-server init` to auto-detect your Expo project and configure the Babel preset + MCP client in one step.

---

## Compatibility

| Environment                                     | Support     | Notes                                          |
| ----------------------------------------------- | ----------- | ---------------------------------------------- |
| Expo Dev Client (`npx expo start --dev-client`) | **Yes**     | Works the same as bare RN                      |
| Expo Go                                         | **Partial** | localhost WebSocket may be limited (see below) |
| EAS Build (development)                         | **Yes**     | Same as Dev Client                             |
| EAS Build (production)                          | **—**       | `__DEV__` is false — MCP runtime is inactive   |

### Why it works

- `runtime.js` is pure JavaScript — Expo uses the same Hermes runtime
- `__REACT_DEVTOOLS_GLOBAL_HOOK__` is a React standard — same in Expo
- WebSocket is built into RN — same in Expo
- `require('react-native')` works the same in Expo

---

## Installation

### 1. Install the package

```bash
npx expo install @ohah/react-native-mcp-server
```

> `npx expo install` automatically picks a version compatible with your Expo SDK. `npm install` also works, but `npx expo install` is recommended.

### 2. Add the Babel preset

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo', '@ohah/react-native-mcp-server/babel-preset'],
  };
};
```

> Expo projects use `babel-preset-expo` (not `module:@react-native/babel-preset`).

To apply only in development builds:

```js
// babel.config.js
module.exports = function (api) {
  api.cache(true);
  const isDev = process.env.NODE_ENV !== 'production';
  return {
    presets: [
      'babel-preset-expo',
      ...(isDev ? ['@ohah/react-native-mcp-server/babel-preset'] : []),
    ],
  };
};
```

### 3. Enable the MCP runtime

The entry point differs depending on your project structure.

#### Expo Router projects (`app/` directory)

Enable in `app/_layout.tsx`:

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

if (__DEV__) {
  // @ts-ignore — injected globally by babel-preset
  global.__REACT_NATIVE_MCP__?.enable();
}

export default function RootLayout() {
  return <Stack />;
}
```

#### Traditional structure (`App.tsx` / `index.js`)

Enable at the top of `index.js` or `App.tsx`:

```js
// index.js (or App.tsx)
import { registerRootComponent } from 'expo';
import App from './App';

global.__REACT_NATIVE_MCP__?.enable();

registerRootComponent(App);
```

> `__REACT_NATIVE_MCP__` is a global object injected by the Babel preset. Without the preset it's `undefined`, so use optional chaining (`?.`) for safe calls.

### 4. Configure the MCP server

Register the server in your MCP client (Cursor, Claude Desktop, etc.). Same as bare RN projects.

```json
{
  "mcpServers": {
    "react-native-mcp": {
      "command": "npx",
      "args": ["-y", "@ohah/react-native-mcp-server"]
    }
  }
}
```

### 5. Run the app

```bash
# Dev Client (recommended)
npx expo start --dev-client

# Or Expo Go (limited — see below)
npx expo start
```

---

## Expo Go Limitations

Expo Go is a pre-built sandbox app. It has the following limitations:

1. **localhost WebSocket**: Expo Go runs in its own network sandbox, so `ws://localhost:12300` may fail.
   - iOS simulator: localhost points to the host machine — **works**
   - Android emulator: requires `adb reverse tcp:12300 tcp:12300`
   - Physical device: must use the host IP instead of localhost; may not be configurable in Expo Go

2. **No custom native modules**: Expo Go only supports pre-included native modules. However, react-native-mcp is pure JS, so this limitation does not apply.

3. **Babel preset**: Works in Expo Go (processed at Metro build time).

**Recommendation**: Use **Expo Dev Client** for a stable development experience.

```bash
# Create a Dev Client build
npx expo run:ios    # or npx expo run:android
# Then run with Dev Client
npx expo start --dev-client
```

---

## Troubleshooting

### MCP connection not working

1. Check that the MCP server is running (port 12300)
2. Verify `__REACT_NATIVE_MCP__?.enable()` is called — check with `console.log(typeof __REACT_NATIVE_MCP__)`
3. Verify the Babel preset is applied — clear Metro cache and restart:
   ```bash
   npx expo start --clear
   ```
4. Android emulator requires port forwarding:
   ```bash
   adb reverse tcp:12300 tcp:12300
   ```

### `__REACT_NATIVE_MCP__` is undefined

The Babel preset is not applied.

1. Check that `@ohah/react-native-mcp-server/babel-preset` is in `babel.config.js`
2. Clear Metro cache: `npx expo start --clear`
3. Verify the package is installed: `npx expo install @ohah/react-native-mcp-server`

### WebSocket connection fails in Expo Go

If using Expo Go on a physical device (not simulator/emulator), localhost connections are not possible. Switch to Dev Client, or use the host machine's IP address.

For more connection issues, see the [Troubleshooting](./troubleshooting) page.
