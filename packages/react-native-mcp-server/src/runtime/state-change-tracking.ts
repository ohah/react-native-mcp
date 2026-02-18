import { collectStateChanges } from './state-hooks';

// ─── onCommitFiberRoot 래핑 — 상태 변경 추적 ─────────────────────
// DevTools hook의 onCommitFiberRoot를 래핑해 커밋마다 state 변경 수집.
// MCP가 hook을 설치했든 DevTools가 이미 설치했든 동일하게 동작.
(function () {
  var g: any =
    typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : null;
  if (!g || !g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;
  var hook = g.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  var orig = hook.onCommitFiberRoot;
  hook.onCommitFiberRoot = function (rendererID: number, root: any) {
    if (typeof orig === 'function') orig.call(hook, rendererID, root);
    try {
      if (root && root.current) collectStateChanges(root.current);
    } catch (_e) {}
  };
})();
