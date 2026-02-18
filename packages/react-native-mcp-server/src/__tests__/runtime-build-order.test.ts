import { describe, expect, it } from 'bun:test';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const runtimePath = resolve(__dirname, '../../runtime.js');
const runtimeCode = readFileSync(runtimePath, 'utf-8');

describe('runtime.js 빌드 포맷 검증', () => {
  it('IIFE로 감싸져 있음 (import/export 문 없음)', () => {
    // IIFE 시작
    expect(runtimeCode).toContain('(function()');
    // IIFE 종료
    expect(runtimeCode.trimEnd().endsWith('})();')).toBe(true);
    // ESM import/export 문이 없어야 함
    const lines = runtimeCode.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // 주석이나 문자열 내부가 아닌 실제 import/export 문 확인
      if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
      expect(trimmed).not.toMatch(/^import\s+/);
      expect(trimmed).not.toMatch(/^export\s+/);
    }
  });

  it('실행 순서: DevTools hook → state tracking → MCP 할당 → XHR patch → connection', () => {
    // 각 섹션의 위치를 찾아 순서 검증
    const devtoolsPos = runtimeCode.indexOf('__REACT_DEVTOOLS_GLOBAL_HOOK__');
    const stateTrackingPos = runtimeCode.indexOf('collectStateChanges');
    const mcpAssignPos = runtimeCode.indexOf('__REACT_NATIVE_MCP__');
    const xhrPatchPos = runtimeCode.indexOf('XMLHttpRequest.prototype');
    // connection에서 사용하는 wsUrl 또는 WebSocket 연결 코드
    const connectionPos = runtimeCode.indexOf('ws://localhost:12300');

    expect(devtoolsPos).toBeGreaterThan(-1);
    expect(stateTrackingPos).toBeGreaterThan(-1);
    expect(mcpAssignPos).toBeGreaterThan(-1);
    expect(xhrPatchPos).toBeGreaterThan(-1);
    expect(connectionPos).toBeGreaterThan(-1);

    // 순서 검증
    expect(devtoolsPos).toBeLessThan(stateTrackingPos);
    expect(stateTrackingPos).toBeLessThan(mcpAssignPos);
    expect(mcpAssignPos).toBeLessThan(xhrPatchPos);
    expect(xhrPatchPos).toBeLessThan(connectionPos);
  });

  it('ES2015 호환: optional chaining(?.) 및 nullish coalescing(??) 없음', () => {
    // 문자열 리터럴 안의 ?. 와 ?? 는 제외해야 함
    // 간단한 방법: 코드에서 문자열을 제거한 후 검사
    const withoutStrings = runtimeCode
      .replace(/"(?:[^"\\]|\\.)*"/g, '""')
      .replace(/'(?:[^'\\]|\\.)*'/g, "''");

    // ?. (optional chaining) - 정규식에서 /regex/. 형태와 혼동 방지
    const optionalChainMatches = withoutStrings.match(/[a-zA-Z_$)\]]\?\./g);
    expect(optionalChainMatches).toBeNull();

    // ?? (nullish coalescing)
    const nullishMatches = withoutStrings.match(/\?\?(?!=)/g);
    expect(nullishMatches).toBeNull();
  });

  it('API 완전성: __REACT_NATIVE_MCP__에 필요한 메서드가 빌드에 포함됨', () => {
    const requiredMethods = [
      'registerComponent',
      'registerPressHandler',
      'triggerPress',
      'triggerLongPress',
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
      'evaluateInWebViewAsync',
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
      'querySelector',
      'querySelectorAll',
      'getScreenInfo',
      'measureView',
      'measureViewSync',
      'getAccessibilityAudit',
    ];

    for (const method of requiredMethods) {
      expect(runtimeCode).toContain(method);
    }
  });
});
