import { GlobalRegistrator } from '@happy-dom/global-registrator';
try {
  await GlobalRegistrator.unregister();
} catch {}

import { describe, expect, it, beforeAll, mock } from 'bun:test';

// ─── Mock react-native ──────────────────────────────────────────

const MockText = function Text() {};
const MockImage = function Image() {};
const mockRegisterComponent = mock(() => {});
const mockRunApplication = mock((..._args: unknown[]) => {});

mock.module('react-native', () => ({
  AppRegistry: {
    registerComponent: mockRegisterComponent,
    runApplication: mockRunApplication,
  },
  Text: MockText,
  Image: MockImage,
  NativeModules: { SourceCode: { scriptURL: null } },
}));

// __DEV__ false → WebSocket 연결 스킵
(globalThis as Record<string, unknown>).__DEV__ = false;

// XHR mock
class MockXMLHttpRequest {
  status = 0;
  statusText = '';
  responseText = '';
  _listeners: Record<string, Array<() => void>> = {};
  open(_method: string, _url: string) {}
  send(_body?: unknown) {}
  setRequestHeader(_name: string, _value: string) {}
  addEventListener(event: string, cb: () => void) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }
  getAllResponseHeaders() {
    return '';
  }
  _fireEvent(event: string) {
    (this._listeners[event] || []).forEach((cb) => cb());
  }
}
(globalThis as Record<string, unknown>).XMLHttpRequest = MockXMLHttpRequest;

const REQUIRED_MCP_METHODS = [
  'registerComponent',
  'registerPressHandler',
  'triggerPress',
  'getRegisteredPressTestIDs',
  'getClickables',
  'getTextNodes',
  'getComponentTree',
  'pressByLabel',
  'longPressByLabel',
  'typeText',
  'registerWebView',
  'unregisterWebView',
  'getWebViewIdForRef',
  'clickInWebView',
  'evaluateInWebView',
  'handleWebViewMessage',
  'createWebViewOnMessage',
  'getRegisteredWebViewIds',
  'registerScrollRef',
  'unregisterScrollRef',
  'scrollTo',
  'getRegisteredScrollTestIDs',
  'getConsoleLogs',
  'clearConsoleLogs',
  'getNetworkRequests',
  'clearNetworkRequests',
  'inspectState',
  'getStateChanges',
  'clearStateChanges',
  'enable',
  'triggerLongPress',
] as const;

type MCPApi = {
  [K in (typeof REQUIRED_MCP_METHODS)[number]]: (...args: unknown[]) => unknown;
};

let MCP!: MCPApi;

beforeAll(async () => {
  const runtimePath = require.resolve('../../runtime.js');
  delete require.cache[runtimePath];
  await import('../../runtime.js');
  MCP = (globalThis as Record<string, unknown>).__REACT_NATIVE_MCP__ as MCPApi;
});

describe('runtime 초기화 순서 검증', () => {
  it('DevTools hook이 먼저 설치되어 __REACT_DEVTOOLS_GLOBAL_HOOK__ 존재', () => {
    const hook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
    expect(hook).toBeDefined();
    expect(typeof (hook as Record<string, unknown>).onCommitFiberRoot).toBe('function');
    expect(typeof (hook as Record<string, unknown>).getFiberRoots).toBe('function');
  });

  it('MCP 객체가 globalThis.__REACT_NATIVE_MCP__에 할당됨', () => {
    expect(MCP).toBeDefined();
    expect(typeof MCP).toBe('object');
  });

  it('모든 REQUIRED_MCP_METHODS가 함수로 존재', () => {
    for (const fn of REQUIRED_MCP_METHODS) {
      expect(typeof MCP[fn]).toBe('function');
    }
  });

  it('XHR prototype이 패치됨 (open/send 래핑)', () => {
    const XHRClass = (globalThis as Record<string, unknown>).XMLHttpRequest as new () => {
      open: (m: string, u: string) => void;
      send: (b?: unknown) => void;
    };
    const xhr = new XHRClass();
    // 패치된 open은 __mcpNetworkEntry를 설정
    xhr.open('GET', 'https://test.com');
    expect((xhr as Record<string, unknown>).__mcpNetworkEntry).toBeDefined();
    const entry = (xhr as Record<string, unknown>).__mcpNetworkEntry as Record<string, unknown>;
    expect(entry.method).toBe('GET');
    expect(entry.url).toBe('https://test.com');
  });

  it('nativeLoggingHook이 설정됨', () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook;
    expect(typeof hook).toBe('function');
  });
});
