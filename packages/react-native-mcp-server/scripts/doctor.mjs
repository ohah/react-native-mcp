#!/usr/bin/env node
/**
 * React Native MCP Doctor — 도입 환경 검사 (React Native doctor 스타일).
 * 앱 루트에서 실행: node node_modules/@ohah/react-native-mcp-server/scripts/doctor.mjs
 * 또는: npx @ohah/react-native-mcp-server doctor
 * exit 0: 필수 검사 모두 통과, exit 1: 일부 실패 (CI에서 사용 가능).
 */

import fs from 'fs';
import net from 'net';
import path from 'path';
import { execSync } from 'child_process';

const MIN_NODE_MAJOR = 24;
const MIN_RN_VERSION = '0.74.0';
const METRO_STATUS_URL = 'http://localhost:8081/status';
const WS_PORT = 12300;

function parseVersion(s) {
  if (!s || typeof s !== 'string') return null;
  const match = s.match(/(\d+)\.(\d+)(?:\.(\d+))?/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3] || '0', 10),
  };
}

function versionGte(a, b) {
  if (!a || !b) return false;
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
}

function inPath(cmd) {
  try {
    const query = process.platform === 'win32' ? `where ${cmd}` : `which ${cmd}`;
    execSync(query, { stdio: 'ignore', encoding: 'utf8' });
    return true;
  } catch {
    return false;
  }
}

function getCommandOutput(cmd) {
  try {
    return execSync(cmd, {
      encoding: 'utf8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return null;
  }
}

/**
 * Check if a TCP port is available (i.e. nothing is listening on it).
 * Returns a promise that resolves to true if available, false if in use.
 */
function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(false); // port is in use
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(true); // port is available (no response)
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(true); // port is available (connection refused)
    });
    socket.connect(port, '127.0.0.1');
  });
}

/**
 * Check if Metro bundler is running by fetching its status endpoint.
 */
async function checkMetroRunning() {
  try {
    const response = await fetch(METRO_STATUS_URL, {
      signal: AbortSignal.timeout(2000),
    });
    const text = await response.text();
    return text.includes('packager-status:running');
  } catch {
    return false;
  }
}

const cwd = process.cwd();
const pkgPath = path.join(cwd, 'package.json');
let pkg = null;
try {
  pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
} catch {}

const rnVersion = pkg?.dependencies?.['react-native'] || pkg?.devDependencies?.['react-native'];
const hasMetroConfig =
  fs.existsSync(path.join(cwd, 'metro.config.js')) ||
  fs.existsSync(path.join(cwd, 'metro.config.ts'));

const lines = [];
let failedCount = 0;

// ---- Common ----
lines.push('Common');
const nodeVersion = parseVersion(process.version.slice(1));
const minNode = { major: MIN_NODE_MAJOR, minor: 0, patch: 0 };
const nodeOk = nodeVersion && versionGte(nodeVersion, minNode);
if (!nodeOk) failedCount++;
lines.push(
  nodeOk
    ? ` ✓ Node.js ${process.version}`
    : ` ✗ Node.js ${process.version} - Required >= ${MIN_NODE_MAJOR}`
);
lines.push('');

// ---- React Native ----
lines.push('React Native');
if (rnVersion) {
  const rnParsed = parseVersion(rnVersion);
  const minRn = parseVersion(MIN_RN_VERSION);
  const rnOk = rnParsed && versionGte(rnParsed, minRn);
  if (!rnOk) failedCount++;
  lines.push(
    rnOk
      ? ` ✓ react-native ${rnVersion}`
      : ` ✗ react-native ${rnVersion} - Required >= ${MIN_RN_VERSION} (New Architecture)`
  );
} else {
  lines.push(' ○ react-native - Not in this project (skipped)');
}
if (hasMetroConfig) {
  lines.push(' ✓ metro.config.js found');
} else {
  lines.push(' ○ metro.config.js - Not found (optional; use if you run Metro with custom config)');
}
lines.push('');

// ---- Babel Preset ----
lines.push('Babel Preset');
const BABEL_CONFIG_FILES = [
  'babel.config.js',
  'babel.config.cjs',
  'babel.config.mjs',
  '.babelrc',
  '.babelrc.js',
];
let babelConfigFound = null;
for (const name of BABEL_CONFIG_FILES) {
  const full = path.join(cwd, name);
  if (fs.existsSync(full)) {
    babelConfigFound = { name, full };
    break;
  }
}
if (babelConfigFound) {
  try {
    const babelContent = fs.readFileSync(babelConfigFound.full, 'utf8');
    const hasMcpPreset = babelContent.includes('react-native-mcp-server/babel-preset');
    if (hasMcpPreset) {
      lines.push(` ✓ ${babelConfigFound.name} contains react-native-mcp-server/babel-preset`);
    } else {
      failedCount++;
      lines.push(
        ` ✗ ${babelConfigFound.name} found but missing react-native-mcp-server/babel-preset`
      );
    }
  } catch {
    lines.push(` ○ ${babelConfigFound.name} - Could not read file`);
  }
} else {
  lines.push(' ○ babel config - Not found (skipped)');
}
lines.push('');

// ---- Metro / WebSocket (async checks) ----
const [metroRunning, wsPortAvailable] = await Promise.all([
  checkMetroRunning(),
  checkPortAvailable(WS_PORT),
]);

lines.push('Metro Bundler');
if (metroRunning) {
  lines.push(` ✓ Metro is running on ${METRO_STATUS_URL}`);
} else {
  lines.push(" ○ Metro is not running (start with 'npx react-native start' before using MCP)");
}
lines.push('');

lines.push('WebSocket Port');
if (wsPortAvailable) {
  lines.push(` ✓ Port ${WS_PORT} is available`);
} else {
  lines.push(` ✗ Port ${WS_PORT} is already in use — MCP server needs this port`);
  failedCount++;
}
lines.push('');

// ---- E2E (idb / adb) ----
lines.push('E2E (optional)');
if (process.platform === 'darwin') {
  const idbOk = inPath('idb');
  if (!idbOk) {
    lines.push(
      ' ○ idb - Not in PATH (required for iOS simulator automation, see docs/references/idb-setup.md)'
    );
  } else {
    const idbVersion = getCommandOutput('idb --version') || 'unknown';
    lines.push(` ✓ idb (${idbVersion})`);
  }
} else {
  lines.push(' ○ idb - macOS only (skip on this OS)');
}
const adbOk = inPath('adb');
if (!adbOk) {
  lines.push(' ○ adb - Not in PATH (required for Android automation)');
} else {
  const adbVersionRaw = getCommandOutput('adb --version');
  const adbVersionMatch = adbVersionRaw?.match(/Android Debug Bridge version ([\d.]+)/);
  const adbVersionStr = adbVersionMatch ? adbVersionMatch[1] : 'unknown';
  lines.push(` ✓ adb (${adbVersionStr})`);
}
lines.push('');

// ---- Simulator / Emulator Status ----
lines.push('Simulator / Emulator');
if (process.platform === 'darwin') {
  const bootedSims = getCommandOutput('xcrun simctl list devices booted -j');
  if (bootedSims) {
    try {
      const simJson = JSON.parse(bootedSims);
      const booted = Object.values(simJson.devices || {})
        .flat()
        .filter((d) => d.state === 'Booted');
      if (booted.length > 0) {
        lines.push(` ✓ iOS Simulator: ${booted.length} booted`);
        for (const d of booted) {
          lines.push(`   - ${d.name} (${d.udid})`);
        }
      } else {
        lines.push(' ○ iOS Simulator: No booted devices');
      }
    } catch {
      lines.push(' ○ iOS Simulator: Could not parse device list');
    }
  } else {
    lines.push(' ○ iOS Simulator: xcrun simctl not available');
  }
} else {
  lines.push(' ○ iOS Simulator - macOS only (skip on this OS)');
}

if (adbOk) {
  const adbDevicesRaw = getCommandOutput('adb devices');
  if (adbDevicesRaw) {
    const deviceLines = adbDevicesRaw
      .split('\n')
      .slice(1)
      .filter((l) => l.trim() && l.includes('\t'));
    const emulators = deviceLines.filter((l) => l.includes('emulator'));
    const devices = deviceLines.filter((l) => !l.includes('emulator'));
    if (deviceLines.length > 0) {
      lines.push(` ✓ Android: ${emulators.length} emulator(s), ${devices.length} device(s)`);
      for (const d of deviceLines) {
        const parts = d.split('\t');
        lines.push(`   - ${parts[0]} (${parts[1]?.trim() || 'unknown'})`);
      }
    } else {
      lines.push(' ○ Android: No connected devices or emulators');
    }
  } else {
    lines.push(' ○ Android: Could not list devices');
  }
} else {
  lines.push(' ○ Android: adb not available (skipped)');
}
lines.push('');

// ---- Summary ----
lines.push('---');
if (failedCount > 0) {
  lines.push(`${failedCount} required check(s) failed.`);
  lines.push('');
  process.stdout.write(lines.join('\n'));
  process.exit(1);
}
lines.push('All required checks passed.');
lines.push('');
process.stdout.write(lines.join('\n'));
