import { pushConsoleLog, nextConsoleLogId } from './shared';

// ─── nativeLoggingHook 체이닝 — 콘솔 로그 캡처 ─────────────────
var _origNativeLoggingHook =
  typeof global !== 'undefined' ? (global as any).nativeLoggingHook : undefined;
if (typeof global !== 'undefined') {
  (global as any).nativeLoggingHook = function (msg: string, level: number) {
    pushConsoleLog({
      id: nextConsoleLogId(),
      message: msg,
      level: level,
      timestamp: Date.now(),
    });
    if (typeof _origNativeLoggingHook === 'function') _origNativeLoggingHook(msg, level);
  };
}
