import type { Fiber } from './types';
import { getFiberRoot } from './fiber-helpers';
import { pressHandlers } from './shared';

export function registerComponent(name: string, component: () => any): any {
  return require('react-native').AppRegistry.registerComponent(name, component);
}

export function registerPressHandler(testID: string, handler: Function): void {
  if (typeof testID === 'string' && typeof handler === 'function') pressHandlers[testID] = handler;
}

export function triggerPress(testID: string): boolean {
  var h = pressHandlers[testID];
  if (typeof h === 'function') {
    h();
    return true;
  }
  // Fiber fallback: Babel 주입(INJECT_PRESS_HANDLER) 비활성 시 Fiber memoizedProps.onPress() 직접 호출
  var root = getFiberRoot();
  if (root) {
    var found = (function findByTestID(fiber: Fiber | null): Fiber | null {
      if (!fiber) return null;
      if (
        fiber.memoizedProps &&
        fiber.memoizedProps.testID === testID &&
        typeof fiber.memoizedProps.onPress === 'function'
      )
        return fiber;
      return findByTestID(fiber.child) || findByTestID(fiber.sibling);
    })(root);
    if (found) {
      found.memoizedProps!.onPress();
      return true;
    }
  }
  return false;
}

export function triggerLongPress(testID: string): boolean {
  var root = getFiberRoot();
  if (!root) return false;
  var found = (function find(fiber: Fiber | null): Fiber | null {
    if (!fiber) return null;
    if (
      fiber.memoizedProps &&
      fiber.memoizedProps.testID === testID &&
      typeof fiber.memoizedProps.onLongPress === 'function'
    )
      return fiber;
    return find(fiber.child) || find(fiber.sibling);
  })(root);
  if (found) {
    found.memoizedProps!.onLongPress();
    return true;
  }
  return false;
}

export function getRegisteredPressTestIDs(): string[] {
  return Object.keys(pressHandlers);
}
