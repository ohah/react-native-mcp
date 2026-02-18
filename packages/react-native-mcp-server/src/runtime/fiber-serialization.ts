import type { Fiber } from './types';
import { getFiberTypeName, collectText } from './fiber-helpers';
import { getPathUid } from './query-selector';
import { measureViewSync } from './mcp-measure';
import { getWebViewIdForRef } from './mcp-webview';

/** fiber 노드를 결과 객체로 직렬화 */
export function fiberToResult(fiber: Fiber, TextComp: any, ImgComp: any): any {
  var props = fiber.memoizedProps || {};
  var typeName = getFiberTypeName(fiber);
  var testID =
    typeof props.testID === 'string' && props.testID.trim() ? props.testID.trim() : undefined;
  var text = collectText(fiber, TextComp).replace(/\s+/g, ' ').trim() || undefined;
  var a11y =
    typeof props.accessibilityLabel === 'string' && props.accessibilityLabel.trim()
      ? props.accessibilityLabel.trim()
      : undefined;
  var hasOnPress = typeof props.onPress === 'function';
  var hasOnLongPress = typeof props.onLongPress === 'function';
  var sn = fiber.stateNode;
  var hasScrollTo = !!(
    sn &&
    (typeof sn.scrollTo === 'function' || typeof sn.scrollToOffset === 'function')
  );

  var uid = testID || getPathUid(fiber);
  var result: any = { uid: uid, type: typeName };
  if (testID) result.testID = testID;
  if (text) result.text = text;
  if (a11y) result.accessibilityLabel = a11y;
  result.hasOnPress = hasOnPress;
  result.hasOnLongPress = hasOnLongPress;
  result.hasScrollTo = hasScrollTo;
  if (props.value !== undefined) result.value = props.value;
  if (props.disabled != null) result.disabled = !!props.disabled;
  if (props.editable !== undefined) result.editable = props.editable;
  // Fabric: measureViewSync → 동기 좌표, Bridge: null
  var measure = null;
  try {
    measure = measureViewSync(uid);
  } catch (e) {}
  // composite fiber(AnimatedComponent 등)면 measure가 null일 수 있음.
  // 하위 첫 번째 host child의 uid로 재시도.
  if (!measure && typeof fiber.type !== 'string') {
    var hostChild = (function findHost(f: Fiber | null): Fiber | null {
      if (!f) return null;
      if (typeof f.type === 'string' && f.stateNode) return f;
      var c = f.child;
      while (c) {
        var h = findHost(c);
        if (h) return h;
        c = c.sibling;
      }
      return null;
    })(fiber.child);
    if (hostChild) {
      var hostUid =
        (hostChild.memoizedProps && hostChild.memoizedProps.testID) || getPathUid(hostChild);
      try {
        measure = measureViewSync(hostUid);
      } catch (e) {}
      // Bridge fallback용: host child uid 저장
      if (!measure) result._measureUid = hostUid;
    }
  }
  result.measure = measure;
  // WebView: 등록된 ref→id가 있으면 webViewId 포함 (selector로 찾은 WebView에 스크립트 실행 시 사용)
  if (typeName === 'WebView' && sn && typeof sn.injectJavaScript === 'function') {
    var wvId = getWebViewIdForRef(sn);
    if (wvId) result.webViewId = wvId;
  }
  return result;
}
