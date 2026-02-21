import type { Fiber } from './types';
import { getFiberRoot, getRNComponents, getLabel } from './fiber-helpers';

/**
 * Fiber 트리에서 라벨(텍스트)에 해당하는 onPress 노드들을 순서대로 수집한 뒤, index번째(0-based) 호출.
 * index 생략 시 0 (첫 번째). querySelectorAll()[index]와 유사.
 */
export function pressByLabel(labelSubstring: string, index?: number): boolean {
  if (typeof labelSubstring !== 'string' || !labelSubstring.trim()) return false;
  try {
    var root = getFiberRoot();
    if (!root) return false;
    var c = getRNComponents();
    var search = labelSubstring.trim();
    var matches: Function[] = [];
    function visit(fiber: Fiber | null) {
      if (!fiber) return;
      var props = fiber.memoizedProps;
      var onPress = props && props.onPress;
      if (typeof onPress === 'function') {
        var label = getLabel(fiber, c.Text, c.Image);
        if (label.indexOf(search) !== -1) matches.push(onPress);
        visit(fiber.sibling);
        return;
      }
      visit(fiber.child);
      visit(fiber.sibling);
    }
    visit(root);
    var idx = typeof index === 'number' && index >= 0 ? index : 0;
    var fn = matches[idx];
    if (typeof fn === 'function') {
      try {
        fn();
      } catch {}
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Fiber 트리에서 라벨(텍스트)에 해당하는 onLongPress 노드들을 순서대로 수집한 뒤, index번째(0-based) 호출.
 */
export function longPressByLabel(labelSubstring: string, index?: number): boolean {
  if (typeof labelSubstring !== 'string' || !labelSubstring.trim()) return false;
  try {
    var root = getFiberRoot();
    if (!root) return false;
    var c = getRNComponents();
    var search = labelSubstring.trim();
    var matches: Function[] = [];
    function visitLP(fiber: Fiber | null) {
      if (!fiber) return;
      var props = fiber.memoizedProps;
      var onLP = props && props.onLongPress;
      if (typeof onLP === 'function') {
        var label = getLabel(fiber, c.Text, c.Image);
        if (label.indexOf(search) !== -1) matches.push(onLP);
        visitLP(fiber.sibling);
        return;
      }
      visitLP(fiber.child);
      visitLP(fiber.sibling);
    }
    visitLP(root);
    var idx = typeof index === 'number' && index >= 0 ? index : 0;
    var fn = matches[idx];
    if (typeof fn === 'function') {
      try {
        fn();
      } catch {}
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * TextInput에 텍스트 입력. Fiber에서 testID 매칭 → onChangeText(text) 호출 + setNativeProps 동기화.
 */
export function typeText(testID: string, text: string): { ok: boolean; error?: string } {
  try {
    var root = getFiberRoot();
    if (!root) return { ok: false, error: 'No Fiber root' };
    var found = (function find(fiber: Fiber | null): Fiber | null {
      if (!fiber) return null;
      if (
        fiber.memoizedProps &&
        fiber.memoizedProps.testID === testID &&
        typeof fiber.memoizedProps.onChangeText === 'function'
      )
        return fiber;
      return find(fiber.child) || find(fiber.sibling);
    })(root);
    if (!found) return { ok: false, error: 'TextInput not found: ' + testID };
    found.memoizedProps!.onChangeText(text);
    if (found.stateNode && typeof found.stateNode.setNativeProps === 'function') {
      found.stateNode.setNativeProps({ text: text });
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e) };
  }
}
