import type { Fiber } from './types';
import { getFiberRoot, getRNComponents, getFiberTypeName } from './fiber-helpers';
import { parseSelector, matchesComplexSelector } from './query-selector';
import { parseHooks, safeClone } from './state-hooks';
import { stateChanges, resetStateChanges } from './shared';

/**
 * inspectState(selector) → 셀렉터로 찾은 컴포넌트의 state Hook 목록.
 * 반환: { component, hooks: [{ index, type, value }] } 또는 null.
 * FunctionComponent가 아닌 host fiber가 매칭되면 가장 가까운 조상 FunctionComponent로 이동.
 */
export function inspectState(selector: string): any {
  if (typeof selector !== 'string' || !selector.trim()) return null;
  try {
    var root = getFiberRoot();
    if (!root) return null;
    var c = getRNComponents();
    var parsed;
    try {
      parsed = parseSelector(selector.trim());
    } catch {
      return null;
    }
    // 첫 번째 매칭 fiber 찾기
    var foundFiber: Fiber | null = null;
    for (var si = 0; si < parsed.selectors.length && !foundFiber; si++) {
      var complex = parsed.selectors[si];
      (function visit(fiber: Fiber | null) {
        if (!fiber || foundFiber) return;
        if (matchesComplexSelector(fiber, complex, c.Text, c.Image)) {
          foundFiber = fiber;
          return;
        }
        visit(fiber.child);
        visit(fiber.sibling);
      })(root);
    }
    if (!foundFiber) return null;
    // host fiber면 조상 FunctionComponent로 이동
    var target: Fiber = foundFiber;
    if (target.tag !== 0 && target.tag !== 1) {
      var p = target.return;
      while (p) {
        if (p.tag === 0 || p.tag === 1) {
          target = p;
          break;
        }
        p = p.return;
      }
      if (target.tag !== 0 && target.tag !== 1) return null;
    }
    var hooks = parseHooks(target);
    return {
      component: getFiberTypeName(target),
      hooks: hooks.map(function (h) {
        return { index: h.index, type: h.type, value: safeClone(h.value) };
      }),
    };
  } catch {
    return null;
  }
}

/**
 * getStateChanges(options) → 상태 변경 이력 조회.
 * options: { component?, since?, limit? }
 */
export function getStateChanges(options?: any): any[] {
  var opts = typeof options === 'object' && options !== null ? options : {};
  var out = stateChanges;
  if (typeof opts.component === 'string' && opts.component) {
    var componentFilter = opts.component;
    out = out.filter(function (entry) {
      return entry.component === componentFilter;
    });
  }
  if (typeof opts.since === 'number') {
    var since = opts.since;
    out = out.filter(function (entry) {
      return entry.timestamp > since;
    });
  }
  var limit = typeof opts.limit === 'number' && opts.limit > 0 ? opts.limit : 100;
  if (out.length > limit) out = out.slice(out.length - limit);
  return out;
}

/** 상태 변경 버퍼 초기화 */
export function clearStateChanges(): void {
  resetStateChanges();
}
