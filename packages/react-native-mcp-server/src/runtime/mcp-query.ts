import type { Fiber } from './types';
import { getFiberRoot, getRNComponents } from './fiber-helpers';
import { parseSelector, matchesComplexSelector } from './query-selector';
import { fiberToResult } from './fiber-serialization';
import { measureView, measureByNativeTag } from './mcp-measure';

/**
 * querySelectorAll(selector) → 매칭되는 모든 fiber 정보 배열.
 */
export function querySelectorAll(selector: string): any[] {
  if (typeof selector !== 'string' || !selector.trim()) return [];
  try {
    var root = getFiberRoot();
    if (!root) return [];
    var c = getRNComponents();
    var parsed;
    try {
      parsed = parseSelector(selector.trim());
    } catch {
      return []; // 따옴표 미닫힘 등 파싱 실패 시 빈 배열
    }
    var results: any[] = [];

    for (var si = 0; si < parsed.selectors.length; si++) {
      var complex = parsed.selectors[si];
      var lastSeg = complex.segments[complex.segments.length - 1];
      var nth = lastSeg.selector.nth;
      var matchCount = 0;

      (function visit(fiber: Fiber | null) {
        if (!fiber) return;
        if (matchesComplexSelector(fiber, complex, c.Text, c.Image)) {
          if (nth === -1 || nth === -2) {
            results.push(fiberToResult(fiber, c.Text, c.Image));
          } else if (matchCount === nth) {
            results.push(fiberToResult(fiber, c.Text, c.Image));
          }
          matchCount++;
        }
        visit(fiber.child);
        visit(fiber.sibling);
      })(root);
    }

    // :last-of-type → keep only the last match
    if (lastSeg!.selector.nth === -2 && results.length > 1) {
      results = [results[results.length - 1]];
    }

    // 같은 testID를 가진 중복 제거: capabilities가 더 많은 쪽 유지
    var deduped: any[] = [];
    var seen: Record<string, number> = {};
    for (var di = 0; di < results.length; di++) {
      var r = results[di];
      var key = r.uid || '';
      if (!key || seen[key] === undefined) {
        seen[key] = deduped.length;
        deduped.push(r);
      } else {
        // 이미 있으면 capabilities 병합 (hasScrollTo, hasOnPress 중 true 우선)
        var idx = seen[key];
        if (idx !== undefined) {
          var prev = deduped[idx];
          if (r.hasScrollTo && !prev.hasScrollTo) deduped[idx] = r;
          else if (r.hasOnPress && !prev.hasOnPress) deduped[idx] = r;
        }
      }
    }
    return deduped;
  } catch {
    return [];
  }
}

/**
 * querySelector(selector) → 첫 번째 매칭 fiber 정보 또는 null.
 */
export function querySelector(selector: string): any {
  if (typeof selector !== 'string' || !selector.trim()) return null;
  try {
    var all = querySelectorAll(selector);
    return all.length > 0 ? all[0] : null;
  } catch {
    return null;
  }
}

/**
 * querySelectorWithMeasure(selector) → Promise<결과 | null>
 * Fabric: fiberToResult의 measureViewSync로 이미 measure 포함 → 즉시 반환.
 * Bridge: measure가 null인 경우 async measureView fallback.
 */
export function querySelectorWithMeasure(selector: string): Promise<any> {
  var el = querySelector(selector);
  if (!el) return Promise.resolve(null);
  if (el.measure) return Promise.resolve(el);
  // Bridge fallback 우선순위:
  // 1. _nativeTag: Fiber 재탐색 없이 UIManager.measure 직접 호출 (가장 빠르고 안정적)
  // 2. uid(testID): Fiber에서 testID로 찾아 host child로 이동 후 측정
  // 3. _measureUid(경로): 최후 수단 (Fiber 트리 변경 시 깨질 수 있음)
  if (typeof el._nativeTag === 'number') {
    return measureByNativeTag(el._nativeTag)
      .then(function (m: any) {
        el.measure = m;
        return el;
      })
      .catch(function () {
        return measureView(el.uid)
          .then(function (m: any) {
            el.measure = m;
            return el;
          })
          .catch(function () {
            return el;
          });
      });
  }
  return measureView(el.uid)
    .then(function (m: any) {
      el.measure = m;
      return el;
    })
    .catch(function () {
      if (el._measureUid && el._measureUid !== el.uid) {
        return measureView(el._measureUid)
          .then(function (m: any) {
            el.measure = m;
            return el;
          })
          .catch(function () {
            return el;
          });
      }
      return el;
    });
}

/**
 * querySelectorAllWithMeasure(selector) → Promise<배열>
 * measure가 null인 요소만 비동기 보충.
 */
export function querySelectorAllWithMeasure(selector: string): Promise<any[]> {
  var list = querySelectorAll(selector);
  if (!list.length) return Promise.resolve(list);
  // measure가 null인 요소만 비동기 보충
  var needsMeasure: number[] = [];
  for (var i = 0; i < list.length; i++) {
    if (!list[i].measure) needsMeasure.push(i);
  }
  if (!needsMeasure.length) return Promise.resolve(list);
  // Bridge fallback — sequential measure
  var chain: Promise<any> = Promise.resolve();
  needsMeasure.forEach(function (idx) {
    chain = chain.then(function () {
      var item = list[idx];
      if (typeof item._nativeTag === 'number') {
        return measureByNativeTag(item._nativeTag)
          .then(function (m: any) {
            item.measure = m;
          })
          .catch(function () {
            return measureView(item.uid)
              .then(function (m: any) {
                item.measure = m;
              })
              .catch(function () {});
          });
      }
      return measureView(item.uid)
        .then(function (m: any) {
          item.measure = m;
        })
        .catch(function () {
          if (item._measureUid && item._measureUid !== item.uid) {
            return measureView(item._measureUid)
              .then(function (m: any) {
                item.measure = m;
              })
              .catch(function () {});
          }
        });
    });
  });
  return chain.then(function () {
    return list;
  });
}
