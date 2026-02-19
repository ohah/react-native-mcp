import { collectStateChanges } from './state-hooks';
import { collectRenderEntries } from './render-tracking';
import { collectOverlayHighlights, flushOverlayMeasurements } from './render-overlay';
import { renderProfileActive, overlayActive, incrementRenderCommitCount } from './shared';

// ─── onCommitFiberRoot 래핑 — 상태 변경 + 렌더 프로파일링 + 오버레이 ──
// DevTools hook의 onCommitFiberRoot를 래핑해 커밋마다 state 변경 수집.
// renderProfileActive가 true이면 렌더 프로파일링 데이터도 수집.
// overlayActive가 true이면 시각적 렌더 하이라이트도 수집.
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
    try {
      if (renderProfileActive && root && root.current) {
        incrementRenderCommitCount();
        collectRenderEntries(root.current);
      }
    } catch (_e) {}
    try {
      if (overlayActive && root && root.current) {
        collectOverlayHighlights(root.current);
        flushOverlayMeasurements();
      }
    } catch (_e) {}
  };
})();
