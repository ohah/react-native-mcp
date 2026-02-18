import type { ConsoleLogEntry, NetworkEntry, StateChangeEntry } from './types';

// ─── Press handlers (mcp-registration ↔ mcp-introspection) ──────
export var pressHandlers: Record<string, Function> = {};

// ─── Console log buffer (mcp-console ↔ console-hook) ────────────
export var consoleLogs: ConsoleLogEntry[] = [];
export var consoleLogId = 0;
export var CONSOLE_BUFFER_SIZE = 500;

export function pushConsoleLog(entry: ConsoleLogEntry) {
  consoleLogs.push(entry);
  if (consoleLogs.length > CONSOLE_BUFFER_SIZE) consoleLogs.shift();
}
export function nextConsoleLogId() {
  return ++consoleLogId;
}
export function resetConsoleLogs() {
  consoleLogs = [];
  consoleLogId = 0;
}

// ─── Network request buffer (mcp-network ↔ network-helpers ↔ patches) ─
export var networkRequests: NetworkEntry[] = [];
export var networkRequestId = 0;
export var NETWORK_BUFFER_SIZE = 200;
export var NETWORK_BODY_LIMIT = 10000;

export function nextNetworkRequestId() {
  return ++networkRequestId;
}
export function resetNetworkRequests() {
  networkRequests = [];
  networkRequestId = 0;
}

// ─── Network mock rules (network-mock ↔ xhr-patch ↔ fetch-patch) ─
export interface NetworkMockRule {
  id: number;
  urlPattern: string;
  isRegex: boolean;
  method: string | null;
  response: {
    status: number;
    statusText: string | null;
    headers: Record<string, string>;
    body: string;
    delay: number;
  };
  enabled: boolean;
  hitCount: number;
}
export var networkMockRules: NetworkMockRule[] = [];
export var networkMockId = 0;

// ─── State change buffer (mcp-state ↔ state-hooks) ─────────────
export var stateChanges: StateChangeEntry[] = [];
export var stateChangeId = 0;
export var STATE_CHANGE_BUFFER = 300;

export function pushStateChange(entry: StateChangeEntry) {
  stateChanges.push(entry);
  if (stateChanges.length > STATE_CHANGE_BUFFER) stateChanges.shift();
}
export function nextStateChangeId() {
  return ++stateChangeId;
}
export function resetStateChanges() {
  stateChanges = [];
  stateChangeId = 0;
}
