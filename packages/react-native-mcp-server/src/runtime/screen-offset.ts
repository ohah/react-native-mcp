import { getFiberRoot } from './fiber-helpers';
import type { Fiber } from './types';

// ─── Android 루트 뷰 Y 오프셋 (상태바 등 시스템 UI 보정) ─────────
// Android에서 measureInWindow는 윈도우 기준 좌표를 반환할 수 있지만
// adb shell input은 스크린 절대 좌표를 사용한다.
// screenOffsetY를 더하면 measureInWindow → 스크린 절대 좌표가 된다.
// iOS는 offset 0이므로 Android만 보정.
export var screenOffsetX = 0;
export var screenOffsetY = 0;
var _screenOffsetResolved = false;

export function resolveScreenOffset(): void {
  if (_screenOffsetResolved) return;
  _screenOffsetResolved = true;
  try {
    var rn: any = typeof require !== 'undefined' && require('react-native');
    if (!rn) return;
    var Platform = rn.Platform;
    if (!Platform || Platform.OS !== 'android') return;

    // 1) StatusBar.currentHeight로 상태바 높이(dp) 획득
    var statusBarHeight = 0;
    if (rn.StatusBar && typeof rn.StatusBar.currentHeight === 'number') {
      statusBarHeight = rn.StatusBar.currentHeight;
    }

    // 2) Fabric 루트 뷰 measureInWindow으로 좌표 체계 감지
    var g: any = typeof globalThis !== 'undefined' ? globalThis : global;
    var root = getFiberRoot();
    if (root && g.nativeFabricUIManager) {
      var hostFiber: Fiber | null = null;
      (function findHost(f: Fiber | null) {
        if (!f || hostFiber) return;
        if (f.stateNode && (f.tag === 5 || f.tag === 27)) {
          hostFiber = f;
          return;
        }
        findHost(f.child);
      })(root);
      if (hostFiber) {
        var node = (hostFiber as Fiber).stateNode;
        var shadowNode =
          node.node ||
          (node._internalInstanceHandle &&
            node._internalInstanceHandle.stateNode &&
            node._internalInstanceHandle.stateNode.node);
        if (shadowNode) {
          g.nativeFabricUIManager.measureInWindow(shadowNode, function (x: number, y: number) {
            // rootY ≈ 0 (window 기준) → offset = statusBarHeight
            // rootY ≈ statusBarHeight (screen 기준) → offset = 0
            // 일반적: statusBarHeight - rootY = 필요한 보정값
            screenOffsetX = -x;
            screenOffsetY = statusBarHeight - y;
          });
          return;
        }
      }
    }

    // 3) Fabric 감지 실패 시 (Bridge 또는 루트 미발견):
    //    Bridge의 UIManager.measure는 getLocationOnScreen() 기반이므로
    //    pageX/pageY가 이미 스크린 절대좌표 → offset 불필요.
    //    단, Fabric인데 루트를 못 찾은 경우엔 statusBarHeight를 fallback으로 사용.
    if (g.nativeFabricUIManager) {
      screenOffsetY = statusBarHeight;
    }
    // Bridge: offset = 0 (UIManager.measure가 screen-absolute 반환)
  } catch {
    /* ignore */
  }
}
