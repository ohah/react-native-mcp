import type { Fiber, MeasureResult } from './types';
import { getFiberRoot } from './fiber-helpers';
import { isPathUid, getFiberByPath } from './query-selector';
import { overlayTopInsetDp } from './shared';
import { resolveScreenOffset, screenOffsetX, screenOffsetY } from './screen-offset';

/**
 * getScreenInfo() → { screen, window, scale, fontScale, orientation }
 */
export function getScreenInfo(): any {
  try {
    var rn = typeof require !== 'undefined' && require('react-native');
    if (!rn) return { error: 'react-native not available' };
    var screen = rn.Dimensions.get('screen');
    var win = rn.Dimensions.get('window');
    var pixelRatio = rn.PixelRatio ? rn.PixelRatio.get() : 1;
    var fontScale = rn.PixelRatio ? rn.PixelRatio.getFontScale() : 1;
    var out: Record<string, unknown> = {
      screen: { width: screen.width, height: screen.height },
      window: { width: win.width, height: win.height },
      scale: pixelRatio,
      fontScale: fontScale,
      orientation: win.width > win.height ? 'landscape' : 'portrait',
    };
    if (
      rn.Platform &&
      rn.Platform.OS === 'android' &&
      rn.StatusBar &&
      typeof (rn.StatusBar as any).currentHeight === 'number'
    ) {
      out.statusBarHeightDp = (rn.StatusBar as any).currentHeight / pixelRatio;
    }
    if (overlayTopInsetDp > 0) out.overlayTopInsetDp = overlayTopInsetDp;
    return out;
  } catch (e) {
    return { error: String(e) };
  }
}

/** fiber.child부터 DFS로 첫 번째 host fiber(type=string, stateNode 있음) 탐색 */
function findNearestHost(fiber: Fiber | null): Fiber | null {
  if (!fiber) return null;
  if (typeof fiber.type === 'string' && fiber.stateNode) return fiber;
  var c: Fiber | null = fiber.child;
  while (c) {
    var h = findNearestHost(c);
    if (h) return h;
    c = c.sibling;
  }
  return null;
}

/** stateNode에서 Fabric shadow node 추출 */
function getShadowNode(stateNode: any): any {
  if (!stateNode) return null;
  var sn =
    stateNode.node ||
    (stateNode._internalInstanceHandle &&
      stateNode._internalInstanceHandle.stateNode &&
      stateNode._internalInstanceHandle.stateNode.node);
  if (!sn && stateNode._viewInfo && stateNode._viewInfo.shadowNodeWrapper) {
    sn = stateNode._viewInfo.shadowNodeWrapper;
  }
  return sn || null;
}

/**
 * measureView(uid) → Promise<{ x, y, width, height, pageX, pageY }>
 * uid: testID 또는 경로("0.1.2"). query_selector로 얻은 uid 그대로 사용 가능.
 * Fiber에서 native node를 찾아 measureInWindow (Fabric) 또는 measure (Bridge)로 절대 좌표 반환.
 * pageX/pageY: 화면 왼쪽 상단 기준 절대 좌표 (points).
 */
export function measureView(uid: string): Promise<MeasureResult> {
  return new Promise(function (resolve, reject) {
    try {
      var root = getFiberRoot();
      if (!root) return reject(new Error('no fiber root'));

      var found: Fiber | null = null;
      if (isPathUid(uid)) {
        found = getFiberByPath(root, uid);
        if (found && !found.stateNode) found = null;
      }
      if (!found) {
        // testID로 host fiber 찾기
        (function find(fiber: Fiber | null) {
          if (!fiber || found) return;
          if (fiber.memoizedProps && fiber.memoizedProps.testID === uid && fiber.stateNode) {
            found = fiber;
            return;
          }
          find(fiber.child);
          if (!found) find(fiber.sibling);
        })(root);
      }

      if (!found) return reject(new Error('uid "' + uid + '" not found or has no native view'));

      // class component 등 non-host fiber면 host descendant로 교체
      if (found && typeof found.type !== 'string') {
        var host = findNearestHost(found.child);
        if (host) found = host;
      }

      // Fabric: stateNode.node + nativeFabricUIManager.measureInWindow
      var g: any = typeof globalThis !== 'undefined' ? globalThis : global;
      // Bridge: UIManager.measure
      var rn = typeof require !== 'undefined' && require('react-native');

      // 현재 fiber가 측정 불가면 host 조상으로 올라가서 측정 시도
      while (found) {
        var node = (found as Fiber).stateNode;
        if (g.nativeFabricUIManager && node) {
          var shadowNode = getShadowNode(node);
          if (shadowNode) {
            resolveScreenOffset();
            g.nativeFabricUIManager.measureInWindow(
              shadowNode,
              function (x: number, y: number, w: number, h: number) {
                resolve({
                  x: x,
                  y: y,
                  width: w,
                  height: h,
                  pageX: x + screenOffsetX,
                  pageY: y + screenOffsetY,
                });
              }
            );
            return;
          }
        }

        if (rn && rn.UIManager && rn.findNodeHandle && node) {
          var handle = rn.findNodeHandle(node);
          if (handle) {
            rn.UIManager.measure(
              handle,
              function (x: number, y: number, w: number, h: number, pageX: number, pageY: number) {
                resolve({ x: x, y: y, width: w, height: h, pageX: pageX, pageY: pageY });
              }
            );
            return;
          }
        }

        found = (found as Fiber).return;
      }

      reject(new Error('cannot measure: no native node'));
    } catch (e) {
      reject(e);
    }
  });
}

/**
 * measureViewSync(uid) → { x, y, width, height, pageX, pageY } | null
 * Fabric에서는 동기 호출 가능. Bridge에서는 null → measureView() 사용 권장.
 */
export function measureViewSync(uid: string): MeasureResult | null {
  try {
    var root = getFiberRoot();
    if (!root) return null;

    var found: Fiber | null = null;
    if (isPathUid(uid)) {
      found = getFiberByPath(root, uid);
    }
    if (!found) {
      (function find(fiber: Fiber | null) {
        if (!fiber || found) return;
        if (fiber.memoizedProps && fiber.memoizedProps.testID === uid && fiber.stateNode) {
          found = fiber;
          return;
        }
        find(fiber.child);
        if (!found) find(fiber.sibling);
      })(root);
    }

    if (!found) return null;

    var g: any = typeof globalThis !== 'undefined' ? globalThis : global;

    if (g.nativeFabricUIManager) {
      var sn = getShadowNode(found.stateNode);
      if (!sn) {
        var host = findNearestHost(found.child);
        if (host) sn = getShadowNode(host.stateNode);
      }
      if (sn) {
        var result: MeasureResult | null = null;
        resolveScreenOffset();
        g.nativeFabricUIManager.measureInWindow(
          sn,
          function (x: number, y: number, w: number, h: number) {
            result = {
              x: x,
              y: y,
              width: w,
              height: h,
              pageX: x + screenOffsetX,
              pageY: y + screenOffsetY,
            };
          }
        );
        return result; // Fabric에서는 콜백이 동기 실행
      }
    }

    return null; // Bridge → measureView() 사용 필요
  } catch {
    return null;
  }
}
