import {
  registerComponent,
  registerPressHandler,
  triggerPress,
  triggerLongPress,
  getRegisteredPressTestIDs,
} from './mcp-registration';
import { getClickables, getTextNodes, getComponentTree } from './mcp-introspection';
import { pressByLabel, longPressByLabel, typeText } from './mcp-actions';
import {
  registerWebView,
  unregisterWebView,
  getWebViewIdForRef,
  clickInWebView,
  evaluateInWebView,
  evaluateInWebViewAsync,
  handleWebViewMessage,
  createWebViewOnMessage,
  getRegisteredWebViewIds,
} from './mcp-webview';
import {
  registerScrollRef,
  unregisterScrollRef,
  scrollTo,
  getRegisteredScrollTestIDs,
} from './mcp-scroll';
import { getConsoleLogs, clearConsoleLogs } from './mcp-console';
import { getNetworkRequests, clearNetworkRequests } from './mcp-network';
import {
  addNetworkMock,
  removeNetworkMock,
  listNetworkMocks,
  clearNetworkMocks,
} from './network-mock';
import { inspectState, getStateChanges, clearStateChanges } from './mcp-state';
import { startRenderProfile, getRenderReport, clearRenderProfile } from './mcp-render';
import {
  querySelector,
  querySelectorAll,
  querySelectorWithMeasure,
  querySelectorAllWithMeasure,
} from './mcp-query';
import { getScreenInfo, measureView, measureViewSync } from './mcp-measure';
import { getAccessibilityAudit } from './mcp-accessibility';

// ─── MCP 글로벌 객체 ────────────────────────────────────────────

var MCP: any = {
  registerComponent: registerComponent,
  registerPressHandler: registerPressHandler,
  triggerPress: triggerPress,
  triggerLongPress: triggerLongPress,
  getRegisteredPressTestIDs: getRegisteredPressTestIDs,
  getClickables: getClickables,
  getTextNodes: getTextNodes,
  getComponentTree: getComponentTree,
  pressByLabel: pressByLabel,
  longPressByLabel: longPressByLabel,
  typeText: typeText,
  registerWebView: registerWebView,
  unregisterWebView: unregisterWebView,
  getWebViewIdForRef: getWebViewIdForRef,
  clickInWebView: clickInWebView,
  evaluateInWebView: evaluateInWebView,
  evaluateInWebViewAsync: evaluateInWebViewAsync,
  handleWebViewMessage: handleWebViewMessage,
  createWebViewOnMessage: createWebViewOnMessage,
  getRegisteredWebViewIds: getRegisteredWebViewIds,
  registerScrollRef: registerScrollRef,
  unregisterScrollRef: unregisterScrollRef,
  scrollTo: scrollTo,
  getRegisteredScrollTestIDs: getRegisteredScrollTestIDs,
  getConsoleLogs: getConsoleLogs,
  clearConsoleLogs: clearConsoleLogs,
  getNetworkRequests: getNetworkRequests,
  clearNetworkRequests: clearNetworkRequests,
  addNetworkMock: addNetworkMock,
  removeNetworkMock: removeNetworkMock,
  listNetworkMocks: listNetworkMocks,
  clearNetworkMocks: clearNetworkMocks,
  inspectState: inspectState,
  getStateChanges: getStateChanges,
  clearStateChanges: clearStateChanges,
  querySelector: querySelector,
  querySelectorAll: querySelectorAll,
  querySelectorWithMeasure: querySelectorWithMeasure,
  querySelectorAllWithMeasure: querySelectorAllWithMeasure,
  getScreenInfo: getScreenInfo,
  measureView: measureView,
  measureViewSync: measureViewSync,
  getAccessibilityAudit: getAccessibilityAudit,
  startRenderProfile: startRenderProfile,
  getRenderReport: getRenderReport,
  clearRenderProfile: clearRenderProfile,
};

if (typeof global !== 'undefined') (global as any).__REACT_NATIVE_MCP__ = MCP;
if (typeof globalThis !== 'undefined') (globalThis as any).__REACT_NATIVE_MCP__ = MCP;

export { MCP };
