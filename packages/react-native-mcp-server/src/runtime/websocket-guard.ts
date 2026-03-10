/**
 * WebSocket 네이티브 모듈 방어 패치
 *
 * MCP 서버가 강제 종료(SIGKILL)되면 TCP RST가 발생하고,
 * RN 네이티브 WebSocketModule이 이미 제거된 소켓에 send/close를 시도하면서
 * JS에서 catch 불가능한 RuntimeException을 throw한다.
 * (facebook/react-native#16214, #17494, #9465)
 *
 * 이 모듈은 네이티브 호출 전에 JS 레벨에서 가드를 걸어
 * 죽은 소켓으로의 네이티브 호출을 사전 차단한다.
 *
 * Old Architecture (Bridge) + New Architecture (TurboModules) 양쪽 지원.
 */

'use strict';

(function patchWebSocketModule() {
  // ── 1. 네이티브 모듈 획득 (Old Arch / New Arch 양쪽) ──

  var nativeModule: any = null;

  // New Architecture: TurboModuleRegistry
  try {
    var TurboModuleRegistry = require('react-native/Libraries/TurboModule/TurboModuleRegistry');
    if (TurboModuleRegistry && typeof TurboModuleRegistry.get === 'function') {
      nativeModule = TurboModuleRegistry.get('WebSocketModule');
    }
  } catch {}

  // Old Architecture fallback: NativeModules
  if (!nativeModule) {
    try {
      var NativeModules = require('react-native').NativeModules;
      if (NativeModules) {
        nativeModule = NativeModules.WebSocketModule;
      }
    } catch {}
  }

  if (!nativeModule) return;

  // ── 2. 활성 소켓 ID 추적 ──

  var _openSockets = new Set<number>();

  // connect 래핑: 소켓 ID 등록
  var _origConnect = nativeModule.connect;
  if (typeof _origConnect === 'function') {
    nativeModule.connect = function (
      url: string,
      protocols: any,
      options: any,
      socketId: number
    ) {
      _openSockets.add(socketId);
      return _origConnect.apply(nativeModule, arguments);
    };
  }

  // websocketClosed / websocketFailed 이벤트로 소켓 ID 제거
  try {
    var DeviceEventEmitter =
      require('react-native').DeviceEventEmitter ||
      require('react-native/Libraries/EventEmitter/RCTDeviceEventEmitter');

    if (DeviceEventEmitter && typeof DeviceEventEmitter.addListener === 'function') {
      DeviceEventEmitter.addListener('websocketClosed', function (ev: any) {
        if (ev && ev.id != null) _openSockets.delete(ev.id);
      });
      DeviceEventEmitter.addListener('websocketFailed', function (ev: any) {
        if (ev && ev.id != null) _openSockets.delete(ev.id);
      });
    }
  } catch {}

  // ── 3. send / sendBinary / ping / close 방어 래핑 ──

  function guardMethod(name: string) {
    var orig = nativeModule[name];
    if (typeof orig !== 'function') return;

    nativeModule[name] = function () {
      // 마지막 인자가 socketId
      var socketId = arguments[arguments.length - 1];
      if (!_openSockets.has(socketId)) return;
      try {
        return orig.apply(nativeModule, arguments);
      } catch {}
    };
  }

  guardMethod('send');
  guardMethod('sendBinary');
  guardMethod('ping');
  guardMethod('close');
})();
