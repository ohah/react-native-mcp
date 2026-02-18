import { getFiberRoot } from './fiber-helpers';

// ─── Android 루트 뷰 Y 오프셋 (상태바 등 시스템 UI 보정) ─────────
// Android에서 measureInWindow는 윈도우 기준 좌표를 반환하지만
// adb shell input은 스크린 절대 좌표를 사용. 루트 뷰의 pageY(-36dp 등)가
// 그 차이. iOS는 offset 0이므로 Android만 보정.
export var screenOffsetX = 0;
export var screenOffsetY = 0;
var _screenOffsetResolved = false;

export function resolveScreenOffset(): void {
  if (_screenOffsetResolved) return;
  _screenOffsetResolved = true;
  try {
    var g: any = typeof globalThis !== 'undefined' ? globalThis : global;
    // Android만 보정 필요 (iOS는 offset 0)
    var Platform = require('react-native').Platform;
    if (!Platform || Platform.OS !== 'android') return;

    // 루트 Fiber의 host node를 찾아 measureInWindow
    var root = getFiberRoot();
    if (!root || !g.nativeFabricUIManager) return;
    // 루트 fiber → 첫 번째 host fiber (stateNode가 있는)
    var hostFiber: any = null;
    (function findHost(f: any) {
      if (!f || hostFiber) return;
      if (f.stateNode && (f.tag === 5 || f.tag === 27)) {
        hostFiber = f;
        return;
      }
      findHost(f.child);
    })(root);
    if (!hostFiber) return;
    var node = hostFiber.stateNode;
    var shadowNode =
      node.node ||
      (node._internalInstanceHandle &&
        node._internalInstanceHandle.stateNode &&
        node._internalInstanceHandle.stateNode.node);
    if (!shadowNode) return;
    g.nativeFabricUIManager.measureInWindow(shadowNode, function (x: number, y: number) {
      // 루트가 pageY=-36이면 offset = -(-36) = 36
      screenOffsetX = -x;
      screenOffsetY = -y;
    });
  } catch (e) {
    /* ignore */
  }
}
