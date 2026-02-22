import { MCP } from './mcp-object';
import { setOverlayTopInsetDp } from './shared';

// ─── WebSocket 연결 (__DEV__ 자동 · 릴리즈는 REACT_NATIVE_MCP_ENABLED로 Metro 실행) ─

var _isDevMode =
  (typeof globalThis !== 'undefined' &&
    typeof (globalThis as any).__DEV__ !== 'undefined' &&
    (globalThis as any).__DEV__) ||
  (typeof process !== 'undefined' &&
    process.env &&
    (process.env as any).REACT_NATIVE_MCP_ENABLED === 'true');

if (_isDevMode && typeof console !== 'undefined' && console.warn) {
  console.warn('[MCP] runtime loaded, __REACT_NATIVE_MCP__ available');
}

var wsUrl = 'ws://localhost:12300';
var ws: WebSocket | null = null;
var _reconnectTimer: any = null;
var reconnectDelay = 1000;
var _mcpEnabled = _isDevMode;
var _heartbeatTimer: any = null;
var _pongTimer: any = null;
var HEARTBEAT_INTERVAL_MS = 30000;
var PONG_TIMEOUT_MS = 10000;

function _shouldConnect(): boolean {
  if (_mcpEnabled) return true;
  if (typeof global !== 'undefined' && (global as any).__REACT_NATIVE_MCP_ENABLED__) return true;
  if (typeof globalThis !== 'undefined' && (globalThis as any).__REACT_NATIVE_MCP_ENABLED__)
    return true;
  return false;
}

function _stopHeartbeat(): void {
  if (_heartbeatTimer != null) {
    clearInterval(_heartbeatTimer);
    _heartbeatTimer = null;
  }
  if (_pongTimer != null) {
    clearTimeout(_pongTimer);
    _pongTimer = null;
  }
}

function _startHeartbeat(): void {
  _stopHeartbeat();
  _heartbeatTimer = setInterval(function () {
    if (!ws || ws.readyState !== 1) {
      _stopHeartbeat();
      return;
    }
    try {
      ws.send(JSON.stringify({ type: 'ping' }));
    } catch {
      return;
    }
    _pongTimer = setTimeout(function () {
      // pong not received — close connection (onclose will trigger reconnect)
      if (ws)
        try {
          ws.close();
        } catch {}
    }, PONG_TIMEOUT_MS);
  }, HEARTBEAT_INTERVAL_MS);
}

function connect(): void {
  if (!_shouldConnect()) return;
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  if (ws)
    try {
      ws.close();
    } catch {}
  ws = new WebSocket(wsUrl);
  ws.onopen = function () {
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('[MCP] Connected to server', wsUrl);
    }
    reconnectDelay = 1000;
    if (_reconnectTimer != null) clearTimeout(_reconnectTimer);
    _reconnectTimer = null;
    // 메타데이터 수집 실패가 init 전송을 막지 않도록 분리
    var platform: string | null = null;
    var deviceName: string | null = null;
    var origin: string | null = null;
    var pixelRatio: number | null = null;
    var screenHeight: number | null = null;
    var windowHeight: number | null = null;
    try {
      var rn = require('react-native');
      platform = rn.Platform && rn.Platform.OS;
      deviceName = (rn.Platform && rn.Platform.constants && rn.Platform.constants.Model) || null;
      if (rn.PixelRatio) pixelRatio = rn.PixelRatio.get();
      if (rn.Dimensions) {
        var screenDim = rn.Dimensions.get('screen');
        var windowDim = rn.Dimensions.get('window');
        if (screenDim && typeof screenDim.height === 'number') screenHeight = screenDim.height;
        if (windowDim && typeof windowDim.height === 'number') windowHeight = windowDim.height;
      }
    } catch (_e) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[MCP] Failed to read platform info:',
          _e instanceof Error ? _e.message : String(_e)
        );
      }
    }
    try {
      var _rn = require('react-native');
      var scriptURL =
        _rn.NativeModules && _rn.NativeModules.SourceCode && _rn.NativeModules.SourceCode.scriptURL;
      if (scriptURL && typeof scriptURL === 'string') {
        // Hermes(RN 0.74 이하)에서 URL.origin 미구현 → protocol+host 수동 파싱
        try {
          origin = new URL(scriptURL).origin;
        } catch {
          var match = scriptURL.match(/^(https?:\/\/[^/?#]+)/);
          if (match) origin = match[1] ?? null;
        }
      }
    } catch (_e2) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[MCP] Failed to read metro URL:',
          _e2 instanceof Error ? _e2.message : String(_e2)
        );
      }
    }
    try {
      ws!.send(
        JSON.stringify({
          type: 'init',
          platform: platform,
          deviceId: platform ? platform + '-1' : undefined,
          deviceName: deviceName,
          metroBaseUrl: origin,
          pixelRatio: pixelRatio,
          screenHeight: screenHeight,
          windowHeight: windowHeight,
        })
      );
    } catch (_e3) {
      if (typeof console !== 'undefined' && console.warn) {
        console.warn(
          '[MCP] Failed to send init:',
          _e3 instanceof Error ? _e3.message : String(_e3)
        );
      }
    }
    _startHeartbeat();
  };
  ws.onmessage = function (ev) {
    try {
      var msg = JSON.parse(ev.data as string);
      if (msg.type === 'pong') {
        if (_pongTimer != null) {
          clearTimeout(_pongTimer);
          _pongTimer = null;
        }
        return;
      }
      if (msg.type === 'setTopInsetDp' && typeof msg.topInsetDp === 'number') {
        setOverlayTopInsetDp(msg.topInsetDp);
        return;
      }
      if (msg.method === 'eval' && msg.id != null) {
        var result: any;
        var errMsg: string | null = null;
        try {
          // oxlint-disable-next-line no-eval -- MCP evaluate_script 도구용 의도적 사용
          result = eval(msg.params && msg.params.code != null ? msg.params.code : 'undefined');
        } catch (e: any) {
          errMsg = e && e.message != null ? e.message : String(e);
        }
        function sendEvalResponse(res: any, err: string | null) {
          if (ws && ws.readyState === 1) {
            ws.send(
              JSON.stringify(err != null ? { id: msg.id, error: err } : { id: msg.id, result: res })
            );
          }
        }
        if (errMsg != null) {
          sendEvalResponse(null, errMsg);
        } else if (result != null && typeof result.then === 'function') {
          result.then(
            function (r: any) {
              sendEvalResponse(r, null);
            },
            function (e: any) {
              sendEvalResponse(null, e && e.message != null ? e.message : String(e));
            }
          );
        } else {
          sendEvalResponse(result, null);
        }
      }
    } catch {}
  };
  ws.onclose = function () {
    _stopHeartbeat();
    ws = null;
    _reconnectTimer = setTimeout(function () {
      connect();
      if (reconnectDelay < 30000) reconnectDelay = Math.min(reconnectDelay * 1.5, 30000);
    }, reconnectDelay);
  };
  ws.onerror = function () {};
}

/**
 * 릴리즈 빌드에서 MCP WebSocket 연결을 활성화한다.
 * 권장: 빌드 시 REACT_NATIVE_MCP_ENABLED 로 Metro 실행(transformer가 global 주입). 앱 코드 불필요.
 * 레거시: 앱에서 __REACT_NATIVE_MCP__.enable() 호출도 가능.
 */
MCP.enable = function () {
  _mcpEnabled = true;
  connect();
};

// DEV: 번들 로드 직후 자동 연결
if (_isDevMode) connect();

// runApplication 시점에 미연결이면 한 번 더 시도
var _AppRegistry = require('react-native').AppRegistry;
var _originalRun = _AppRegistry.runApplication;
_AppRegistry.runApplication = function () {
  if (_shouldConnect() && (!ws || ws.readyState !== 1)) connect();
  return _originalRun.apply(this, arguments);
};

// ─── AppState 연동: 백그라운드 시 heartbeat 중단, 포그라운드 복귀 시 재개 ─
(function () {
  try {
    var rn = require('react-native');
    if (rn && rn.AppState && typeof rn.AppState.addEventListener === 'function') {
      rn.AppState.addEventListener('change', function (nextState: string) {
        if (nextState === 'active') {
          if (ws && ws.readyState === 1) _startHeartbeat();
        } else {
          _stopHeartbeat();
        }
      });
    }
  } catch {}
})();

// 주기적 재시도: 앱이 먼저 떠 있고 나중에 MCP를 켜도 자동 연결 (순서 무관)
var PERIODIC_INTERVAL_MS = 5000;
setInterval(function () {
  if (!_shouldConnect()) return;
  if (ws && ws.readyState === 1) return;
  connect();
}, PERIODIC_INTERVAL_MS);
