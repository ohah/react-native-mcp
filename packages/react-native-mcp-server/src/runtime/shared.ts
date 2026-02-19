import type { ConsoleLogEntry, NetworkEntry, StateChangeEntry, RenderEntry } from './types';

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

// ─── Render profile buffer (render-tracking ↔ mcp-render) ───────
export var renderProfileActive = false;
export var renderProfileStartTime = 0;
export var renderCommitCount = 0;
export var renderEntries: RenderEntry[] = [];
export var renderComponentFilter: string[] | null = null; // whitelist (null = 전체)
export var renderIgnoreFilter: string[] | null = null; // blacklist (null = 기본 ignore만)
export var RENDER_BUFFER_SIZE = 5000;

export function setRenderProfileActive(active: boolean) {
  renderProfileActive = active;
}
export function setRenderProfileStartTime(t: number) {
  renderProfileStartTime = t;
}
export function setRenderComponentFilter(components: string[] | null) {
  renderComponentFilter = components;
}
export function setRenderIgnoreFilter(ignore: string[] | null) {
  renderIgnoreFilter = ignore;
}
export function incrementRenderCommitCount() {
  return ++renderCommitCount;
}
export function pushRenderEntry(entry: RenderEntry) {
  renderEntries.push(entry);
  if (renderEntries.length > RENDER_BUFFER_SIZE) renderEntries.shift();
}
export function resetRenderProfile() {
  renderProfileActive = false;
  renderProfileStartTime = 0;
  renderCommitCount = 0;
  renderEntries = [];
  renderComponentFilter = null;
  renderIgnoreFilter = null;
}

// ─── Render highlight (Babel preset: renderHighlight) ─
// Babel이 주입한 global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ 를 모듈 로드 시점에 읽음.
export var renderHighlight =
  typeof global !== 'undefined' &&
  (global as Record<string, unknown>).__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ === true;

// ─── Render overlay (render-overlay ↔ state-change-tracking) ───
export var overlayActive = false;
export var overlayComponentFilter: string[] | null = null;
export var overlayIgnoreFilter: string[] | null = null;
export var overlayShowLabels = false;
export var overlayFadeTimeout = 750;
export var overlayMaxHighlights = 100;
export var overlaySetHighlights: ((highlights: any[]) => void) | null = null;
export var overlayRenderCounts: Record<string, number> = {};

export function setOverlayActive(active: boolean) {
  overlayActive = active;
}
export function setOverlayComponentFilter(components: string[] | null) {
  overlayComponentFilter = components;
}
export function setOverlayIgnoreFilter(ignore: string[] | null) {
  overlayIgnoreFilter = ignore;
}
export function setOverlayShowLabels(show: boolean) {
  overlayShowLabels = show;
}
export function setOverlayFadeTimeout(ms: number) {
  overlayFadeTimeout = ms;
}
export function setOverlayMaxHighlights(max: number) {
  overlayMaxHighlights = max;
}
export function setOverlaySetHighlights(fn: ((highlights: any[]) => void) | null) {
  overlaySetHighlights = fn;
}
export function resetOverlay() {
  overlayActive = false;
  overlayComponentFilter = null;
  overlayIgnoreFilter = null;
  overlayShowLabels = false;
  overlayFadeTimeout = 1500;
  overlayMaxHighlights = 100;
  // overlaySetHighlights는 React 컴포넌트 lifecycle이 관리 — 여기서 초기화하지 않음
  overlayRenderCounts = {};
}
