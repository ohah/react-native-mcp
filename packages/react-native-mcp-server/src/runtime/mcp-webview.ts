var _webViews: Record<string, any> = {};
var _webViewRefToId: WeakMap<any, string> | null =
  typeof WeakMap !== 'undefined' ? new WeakMap() : null;
var _webViewEvalPending: Record<string, { resolve: Function; timeout: any }> = {};
var _webViewEvalRequestId = 0;

export function registerWebView(ref: any, id: string): void {
  if (ref && typeof id === 'string') {
    _webViews[id] = ref;
    if (_webViewRefToId)
      try {
        _webViewRefToId.set(ref, id);
      } catch {}
  }
}

export function unregisterWebView(id: string): void {
  if (typeof id === 'string') {
    var ref = _webViews[id];
    if (ref && _webViewRefToId) _webViewRefToId.delete(ref);
    delete _webViews[id];
  }
}

/** ref에 해당하는 등록된 webViewId 반환 (query_selector로 찾은 WebView → webViewId용) */
export function getWebViewIdForRef(ref: any): string | null {
  return _webViewRefToId && ref ? _webViewRefToId.get(ref) || null : null;
}

export function clickInWebView(id: string, selector: string): { ok: boolean; error?: string } {
  var ref = _webViews[id];
  if (!ref || typeof ref.injectJavaScript !== 'function')
    return { ok: false, error: 'WebView not found or injectJavaScript not available' };
  var script =
    '(function(){ var el = document.querySelector(' +
    JSON.stringify(selector) +
    '); if (el) el.click(); })();';
  ref.injectJavaScript(script);
  return { ok: true };
}

/** 등록된 WebView 내부에서 임의의 JavaScript를 실행 (동기, 반환값 없음) */
export function evaluateInWebView(id: string, script: string): { ok: boolean; error?: string } {
  var ref = _webViews[id];
  if (!ref || typeof ref.injectJavaScript !== 'function')
    return { ok: false, error: 'WebView not found or injectJavaScript not available' };
  ref.injectJavaScript(script);
  return { ok: true };
}

/**
 * WebView에서 스크립트 실행 후 postMessage로 결과 수신.
 * @returns Promise<{ ok: true, value: string } | { ok: false, error: string }>
 */
export function evaluateInWebViewAsync(id: string, script: string): Promise<any> {
  var ref = _webViews[id];
  if (!ref || typeof ref.injectJavaScript !== 'function')
    return Promise.resolve({
      ok: false,
      error: 'WebView not found or injectJavaScript not available',
    });
  var requestId = 'wv_' + ++_webViewEvalRequestId + '_' + Date.now();
  var wrapped =
    '(function(){ var __reqId=' +
    JSON.stringify(requestId) +
    '; var __script=' +
    JSON.stringify(script) +
    '; try { var __r=(function(){ return eval(__script); })(); var __v=typeof __r==="string" ? __r : (function(){ try { return JSON.stringify(__r); } catch(e){ return String(__r); } })(); window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({__mcpEvalResult:true,requestId:__reqId,value:__v})); } catch(e) { window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(JSON.stringify({__mcpEvalResult:true,requestId:__reqId,error:(e&&e.message)||String(e)})); } })();';
  return new Promise(function (resolve) {
    var t = setTimeout(function () {
      if (_webViewEvalPending[requestId]) {
        delete _webViewEvalPending[requestId];
        resolve({ ok: false, error: 'WebView eval timeout (10s)' });
      }
    }, 10000);
    _webViewEvalPending[requestId] = { resolve: resolve, timeout: t };
    ref.injectJavaScript(wrapped);
  });
}

/**
 * WebView onMessage에서 호출. postMessage로 온 __mcpEvalResult 수신 시 evaluateInWebViewAsync Promise resolve.
 * @returns true if the message was __mcpEvalResult (consumed), false otherwise.
 */
export function handleWebViewMessage(data: any): boolean {
  if (!data || typeof data !== 'string') return false;
  try {
    var payload = JSON.parse(data);
    if (!payload || payload.__mcpEvalResult !== true || !payload.requestId) return false;
    var reqId = payload.requestId;
    var pending = _webViewEvalPending[reqId];
    if (!pending) return false;
    delete _webViewEvalPending[reqId];
    if (pending.timeout) clearTimeout(pending.timeout);
    if (payload.error != null) pending.resolve({ ok: false, error: payload.error });
    else pending.resolve({ ok: true, value: payload.value });
    return true;
  } catch {
    return false;
  }
}

/**
 * WebView onMessage와 사용자 핸들러를 함께 쓰기 위한 래퍼.
 */
export function createWebViewOnMessage(userHandler: Function | null): Function {
  if (typeof userHandler !== 'function')
    return function (e: any) {
      (globalThis as any).__REACT_NATIVE_MCP__.handleWebViewMessage(e.nativeEvent.data);
    };
  return function (e: any) {
    var data = e && e.nativeEvent && e.nativeEvent.data;
    var consumed = (globalThis as any).__REACT_NATIVE_MCP__.handleWebViewMessage(data);
    if (!consumed) userHandler(e);
  };
}

export function getRegisteredWebViewIds(): string[] {
  return Object.keys(_webViews);
}
