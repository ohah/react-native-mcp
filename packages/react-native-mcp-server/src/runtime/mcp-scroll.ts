import type { Fiber } from './types';
import { getFiberRoot } from './fiber-helpers';

var _scrollRefs: Record<string, any> = {};

export function registerScrollRef(testID: string, ref: any): void {
  if (typeof testID === 'string' && ref != null) _scrollRefs[testID] = ref;
}

export function unregisterScrollRef(testID: string): void {
  if (typeof testID === 'string') delete _scrollRefs[testID];
}

export function scrollTo(testID: string, options: any): { ok: boolean; error?: string } {
  var ref = _scrollRefs[testID];
  // Fiber fallback: Babel 주입(INJECT_SCROLL_REF) 비활성 시 Fiber stateNode에서 직접 접근
  if (!ref) {
    var root = getFiberRoot();
    if (root) {
      ref = (function findScrollable(fiber: Fiber | null): any {
        if (!fiber) return null;
        if (fiber.memoizedProps && fiber.memoizedProps.testID === testID && fiber.stateNode) {
          var si = fiber.stateNode;
          if (typeof si.scrollTo === 'function' || typeof si.scrollToOffset === 'function')
            return si;
        }
        return findScrollable(fiber.child) || findScrollable(fiber.sibling);
      })(root);
    }
  }
  if (!ref) return { ok: false, error: 'ScrollView not found for testID: ' + testID };
  var opts = typeof options === 'object' && options !== null ? options : {};
  var x = opts.x || 0;
  var y = opts.y || 0;
  var animated = opts.animated !== false;
  try {
    if (typeof ref.scrollTo === 'function') {
      ref.scrollTo({ x: x, y: y, animated: animated });
      return { ok: true };
    }
    if (typeof ref.scrollToOffset === 'function') {
      ref.scrollToOffset({ offset: y, animated: animated });
      return { ok: true };
    }
    return { ok: false, error: 'scrollTo/scrollToOffset not available on stateNode' };
  } catch (e: any) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

export function getRegisteredScrollTestIDs(): string[] {
  return Object.keys(_scrollRefs);
}
