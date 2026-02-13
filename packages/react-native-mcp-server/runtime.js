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
    ws = new WebSocket(wsUrl);
    ws.onopen = function () {
      reconnectDelay = 1000;
      if (_reconnectTimer != null) clearTimeout(_reconnectTimer);
      _reconnectTimer = null;
    };
    ws.onmessage = function (ev) {
      try {
        var msg = JSON.parse(ev.data);
        if (msg.method === 'eval' && msg.id != null) {
          var result;
          var errMsg = null;
          try {
            // Phase 1: 원격 코드 실행 (개발 모드 전용, MCP 서버가 localhost에서만 동작)
            // oxlint-disable-next-line no-eval -- MCP eval_code 도구용 의도적 사용
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

  connect();
}
