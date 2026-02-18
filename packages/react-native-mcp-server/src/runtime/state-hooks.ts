import type { Fiber } from './types';
import { getFiberTypeName } from './fiber-helpers';
import { pushStateChange, nextStateChangeId } from './shared';

/** fiber의 memoizedState 체인에서 state Hook(queue 존재)만 추출 */
export function parseHooks(
  fiber: Fiber | null
): Array<{ index: number; type: string; value: any }> {
  var hooks: Array<{ index: number; type: string; value: any }> = [];
  var hook = fiber ? fiber.memoizedState : null;
  var i = 0;
  while (hook && typeof hook === 'object') {
    if (hook.queue) {
      hooks.push({ index: i, type: 'state', value: hook.memoizedState });
    }
    hook = hook.next;
    i++;
  }
  return hooks;
}

/** 얕은 비교. 참조 동일 → true, 타입 불일치/키 다름 → false */
export function shallowEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;
  if (Array.isArray(a)) {
    if (!Array.isArray(b) || a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }
  var ka = Object.keys(a);
  var kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  for (var j = 0; j < ka.length; j++) {
    var key = ka[j];
    if (key === undefined) continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

/** JSON.stringify 안전 래퍼 (depth 제한 + 순환 참조 방지) */
export function safeClone(val: any, maxDepth?: number): any {
  if (maxDepth === undefined) maxDepth = 4;
  var seen: any[] = [];
  function clone(v: any, depth: number): any {
    if (v === null || v === undefined) return v;
    if (typeof v !== 'object' && typeof v !== 'function') return v;
    if (typeof v === 'function') return '[Function]';
    if (depth > maxDepth!) return '[depth limit]';
    if (seen.indexOf(v) !== -1) return '[Circular]';
    seen.push(v);
    if (Array.isArray(v)) {
      var arr: any[] = [];
      for (var i = 0; i < Math.min(v.length, 100); i++) {
        arr.push(clone(v[i], depth + 1));
      }
      if (v.length > 100) arr.push('...' + (v.length - 100) + ' more');
      return arr;
    }
    var obj: any = {};
    var keys = Object.keys(v);
    for (var j = 0; j < Math.min(keys.length, 50); j++) {
      var key = keys[j];
      if (key === undefined) continue;
      obj[key] = clone(v[key], depth + 1);
    }
    if (keys.length > 50) obj['...'] = keys.length - 50 + ' more keys';
    return obj;
  }
  return clone(val, 0);
}

/**
 * onCommitFiberRoot에서 호출: 변경된 state Hook을 _stateChanges에 수집.
 * fiber.alternate(이전 버전)와 비교해 memoizedState가 달라진 Hook만 기록.
 */
export function collectStateChanges(fiber: Fiber | null): void {
  if (!fiber) return;
  if (fiber.tag === 0 || fiber.tag === 1) {
    var prev = fiber.alternate;
    if (prev) {
      var prevHook = prev.memoizedState;
      var nextHook = fiber.memoizedState;
      var hookIdx = 0;
      while (prevHook && nextHook && typeof prevHook === 'object' && typeof nextHook === 'object') {
        if (nextHook.queue && !shallowEqual(prevHook.memoizedState, nextHook.memoizedState)) {
          var name = getFiberTypeName(fiber);
          pushStateChange({
            id: nextStateChangeId(),
            timestamp: Date.now(),
            component: name,
            hookIndex: hookIdx,
            prev: safeClone(prevHook.memoizedState),
            next: safeClone(nextHook.memoizedState),
          });
        }
        prevHook = prevHook.next;
        nextHook = nextHook.next;
        hookIdx++;
      }
    }
  }
  collectStateChanges(fiber.child);
  collectStateChanges(fiber.sibling);
}
