// ─── DevTools hook 보장 ───────────────────────────────────────
// DEV: React DevTools가 이미 hook을 설치 → 건너뜀.
// Release: hook이 없으므로 MCP가 설치. React 로드 시 inject/onCommitFiberRoot로
// renderer·fiber root를 캡처해 DEV와 동일하게 Fiber 트리 접근 가능.
(function () {
  var g: any =
    typeof globalThis !== 'undefined' ? globalThis : typeof global !== 'undefined' ? global : null;
  if (!g || g.__REACT_DEVTOOLS_GLOBAL_HOOK__) return;

  var _renderers = new Map();
  var _roots = new Map();

  g.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    supportsFiber: true,
    renderers: _renderers,
    inject: function (internals: any) {
      var id = _renderers.size + 1;
      _renderers.set(id, internals);
      return id;
    },
    onCommitFiberRoot: function (rendererID: number, root: any) {
      if (!_roots.has(rendererID)) _roots.set(rendererID, new Set());
      _roots.get(rendererID).add(root);
    },
    onCommitFiberUnmount: function () {},
    getFiberRoots: function (rendererID: number) {
      return _roots.get(rendererID) || new Set();
    },
  };
})();
