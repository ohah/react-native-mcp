/**
 * React Native 앱에 주입되는 MCP 런타임 (Phase 1)
 * - __REACT_NATIVE_MCP__.registerComponent → AppRegistry.registerComponent 위임
 * - __DEV__ 시 WebSocket으로 MCP 서버(12300)에 연결, eval 요청 처리
 *
 * Metro transformer가 진입점 상단에 require('@ohah/react-native-mcp-server/runtime') 주입
 * global은 모듈 로드 직후 최상단에서 설정해 ReferenceError 방지.
 */

'use strict';

var _pressHandlers = {};
var _webViews = {};
var MCP = {
  registerComponent: function (name, component) {
    return require('react-native').AppRegistry.registerComponent(name, component);
  },
  registerPressHandler: function (testID, handler) {
    if (typeof testID === 'string' && typeof handler === 'function')
      _pressHandlers[testID] = handler;
  },
  triggerPress: function (testID) {
    var h = _pressHandlers[testID];
    if (typeof h === 'function') h();
  },
  /** 디버그: 등록된 press handler testID 목록 */
  getRegisteredPressTestIDs: function () {
    return Object.keys(_pressHandlers);
  },
  /**
   * 앱 내 WebView를 MCP에서 제어할 수 있도록 등록.
   * ref: react-native-webview의 ref (injectJavaScript 메서드 필요)
   * id: 웹뷰 식별자 (예: 'main'). click_webview 호출 시 사용.
   */
  registerWebView: function (ref, id) {
    if (ref && typeof id === 'string') _webViews[id] = ref;
  },
  /**
   * 등록된 WebView 내부에서 CSS selector에 해당하는 요소를 클릭.
   * WebView ref.injectJavaScript로 document.querySelector(selector).click() 실행.
   */
  clickInWebView: function (id, selector) {
    var ref = _webViews[id];
    if (!ref || typeof ref.injectJavaScript !== 'function')
      return { ok: false, error: 'WebView not found or injectJavaScript not available' };
    var script =
      '(function(){ var el = document.querySelector(' +
      JSON.stringify(selector) +
      '); if (el) el.click(); })();';
    ref.injectJavaScript(script);
    return { ok: true };
  },
  /** 등록된 WebView에서 URL로 이동 */
  navigateWebView: function (id, url) {
    var ref = _webViews[id];
    if (!ref || typeof ref.injectJavaScript !== 'function')
      return { ok: false, error: 'WebView not found or injectJavaScript not available' };
    var script = 'window.location.href = ' + JSON.stringify(url) + ';';
    ref.injectJavaScript(script);
    return { ok: true };
  },
  /** 디버그: 등록된 웹뷰 id 목록 */
  getRegisteredWebViewIds: function () {
    return Object.keys(_webViews);
  },
  /** 앱 엔트리에서 호출 가능. 릴리즈 빌드에서 MCP 연결 허용 시 사용 (현재 no-op, __DEV__ 시 자동 연결). */
  enable: function () {},
};
if (typeof global !== 'undefined') global.__REACT_NATIVE_MCP__ = MCP;
if (typeof globalThis !== 'undefined') globalThis.__REACT_NATIVE_MCP__ = MCP;

if (typeof __DEV__ !== 'undefined' && __DEV__) {
  var defaultHost = 'localhost';
  var defaultPort = 12300;
  var wsUrl = 'ws://' + defaultHost + ':' + defaultPort;
  var ws = null;
  var _reconnectTimer = null;
  var reconnectDelay = 1000;
  var maxReconnectDelay = 30000;

  function connect() {
    var WS =
      typeof WebSocket !== 'undefined'
        ? WebSocket
        : typeof global !== 'undefined' && global.WebSocket
          ? global.WebSocket
          : null;
    if (!WS) {
      _reconnectTimer = setTimeout(connect, 100);
      return;
    }
    ws = new WS(wsUrl);
    ws.onopen = function () {
      reconnectDelay = 1000;
      if (_reconnectTimer != null) clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
      // 앱이 로드된 Metro origin + 플랫폼 전송 → MCP가 get_debugger_status 등에서 사용
      try {
        var rn = require('react-native');
        var scriptURL =
          rn.NativeModules && rn.NativeModules.SourceCode && rn.NativeModules.SourceCode.scriptURL;
        var payload = { type: 'init' };
        if (scriptURL && typeof scriptURL === 'string') {
          payload.metroBaseUrl = new URL(scriptURL).origin;
        }
        if (rn.Platform && typeof rn.Platform.OS === 'string') {
          payload.platform = rn.Platform.OS;
          payload.deviceId = rn.Platform.OS + '-1';
        }
        ws.send(JSON.stringify(payload));
      } catch (_e) {}
    };
    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.method === 'eval' && msg.id != null) {
          var result;
          var errMsg = null;
          try {
            // Phase 1: 원격 코드 실행 (개발 모드 전용, MCP 서버가 localhost에서만 동작)
            // oxlint-disable-next-line no-eval -- MCP evaluate_script 도구용 의도적 사용
            result = eval(msg.params && msg.params.code != null ? msg.params.code : 'undefined');
          } catch (e) {
            errMsg = e && e.message != null ? e.message : String(e);
          }
          if (ws && ws.readyState === 1) {
            ws.send(
              JSON.stringify(
                errMsg != null ? { id: msg.id, error: errMsg } : { id: msg.id, result: result }
              )
            );
          }
        }
      } catch {}
    };
    ws.onclose = function () {
      ws = null;
      _reconnectTimer = setTimeout(function () {
        connect();
        if (reconnectDelay < maxReconnectDelay)
          reconnectDelay = Math.min(reconnectDelay * 1.5, maxReconnectDelay);
      }, reconnectDelay);
    };
    ws.onerror = function () {};
  }

  // 런타임 로드 직후엔 WebSocket이 없을 수 있음 → 한 틱 미뤄서 연결
  setTimeout(connect, 0);
}
