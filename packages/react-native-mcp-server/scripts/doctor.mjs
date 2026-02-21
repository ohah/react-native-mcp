#!/usr/bin/env node
/**
 * React Native MCP Doctor — 도입 환경 검사 (React Native doctor 스타일).
 * 앱 루트에서 실행: node node_modules/@ohah/react-native-mcp-server/scripts/doctor.mjs
 * 또는: npx @ohah/react-native-mcp-server doctor
 * exit 0: 필수 검사 모두 통과, exit 1: 일부 실패 (CI에서 사용 가능).
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const MIN_NODE_MAJOR = 24;
const MIN_RN_VERSION = '0.74.0';

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
    : ` ✗ Node.js ${process.version} - Required >= ${MIN_NODE_MAJOR} (see docs/compatibility-and-requirements.md)`
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
      : ` ✗ react-native ${rnVersion} - Required >= ${MIN_RN_VERSION} (New Architecture, see docs/compatibility-and-requirements.md)`
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

// ---- E2E (idb / adb) ----
lines.push('E2E (optional)');
if (process.platform === 'darwin') {
  const idbOk = inPath('idb');
  if (!idbOk) {
    lines.push(
      ' ○ idb - Not in PATH (required for iOS simulator automation, see docs/idb-setup.md)'
    );
  } else {
    lines.push(' ✓ idb');
  }
} else {
  lines.push(' ○ idb - macOS only (skip on this OS)');
}
const adbOk = inPath('adb');
if (!adbOk) {
  lines.push(' ○ adb - Not in PATH (required for Android automation)');
} else {
  lines.push(' ✓ adb');
}
lines.push('');

// ---- Summary ----
lines.push('---');
if (failedCount > 0) {
  lines.push(`${failedCount} required check(s) failed. See docs/adoption-checklist.md`);
  lines.push('');
  process.stdout.write(lines.join('\n'));
  process.exit(1);
}
lines.push('All required checks passed.');
lines.push('');
process.stdout.write(lines.join('\n'));
