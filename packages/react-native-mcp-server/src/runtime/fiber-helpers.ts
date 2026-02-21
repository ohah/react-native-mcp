import type { Fiber, DevToolsHook } from './types';

/** DevTools hook에서 root Fiber를 얻는다. hook.getFiberRoots 우선, fallback으로 getCurrentFiber 사용. */
export function getFiberRootFromHook(hook: DevToolsHook, rendererID: number): Fiber | null {
  if (!hook) return null;
  function toRootFiber(r: any): Fiber | null {
    return r && r.current ? r.current : r;
  }
  if (typeof hook.getFiberRoots === 'function') {
    try {
      var roots = hook.getFiberRoots(rendererID);
      if (roots && roots.size > 0) {
        var first = roots.values().next().value;
        if (first) return toRootFiber(first);
      }
    } catch {}
  }
  var renderer = hook.renderers && hook.renderers.get(rendererID);
  if (renderer && typeof renderer.getCurrentFiber === 'function') {
    var fiber = renderer.getCurrentFiber();
    if (fiber) {
      while (fiber && fiber.return) fiber = fiber.return;
      return fiber || null;
    }
  }
  return null;
}

/** __REACT_DEVTOOLS_GLOBAL_HOOK__ 반환. 없으면 null. */
export function getDevToolsHook(): DevToolsHook | null {
  return (
    (typeof global !== 'undefined' && (global as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) ||
    (typeof globalThis !== 'undefined' && (globalThis as any).__REACT_DEVTOOLS_GLOBAL_HOOK__) ||
    null
  );
}

/** DevTools hook → fiber root. 없으면 null. */
export function getFiberRoot(): Fiber | null {
  var hook = getDevToolsHook();
  if (!hook || !hook.renderers) return null;
  return getFiberRootFromHook(hook, 1);
}

/** fiber 하위 Text 노드의 문자열 수집 */
export function collectText(fiber: Fiber | null, TextComponent: any): string {
  if (!fiber) return '';
  if (fiber.type === TextComponent && fiber.memoizedProps) {
    var c = fiber.memoizedProps.children;
    if (typeof c === 'string') return c.trim();
    if (typeof c === 'number' || typeof c === 'boolean') return String(c);
    if (Array.isArray(c))
      return c
        .map(function (x: any) {
          if (typeof x === 'string') return x;
          if (typeof x === 'number' || typeof x === 'boolean') return String(x);
          return '';
        })
        .join('')
        .trim();
  }
  var s = '';
  var ch = fiber.child;
  while (ch) {
    s += collectText(ch, TextComponent);
    ch = ch.sibling;
  }
  return s;
}

/** fiber의 accessibilityLabel 또는 자식 Image의 accessibilityLabel 수집 */
export function collectAccessibilityLabel(fiber: Fiber | null, ImageComponent: any): string {
  if (!fiber || !fiber.memoizedProps) return '';
  var p = fiber.memoizedProps;
  if (typeof p.accessibilityLabel === 'string' && p.accessibilityLabel.trim())
    return p.accessibilityLabel.trim();
  var ch = fiber.child;
  while (ch) {
    if (
      ch.type === ImageComponent &&
      ch.memoizedProps &&
      typeof ch.memoizedProps.accessibilityLabel === 'string'
    )
      return ch.memoizedProps.accessibilityLabel.trim();
    ch = ch.sibling;
  }
  return '';
}

/** fiber에서 사용자에게 보이는 라벨 추출 (text 우선, a11y fallback) */
export function getLabel(fiber: Fiber, TextComponent: any, ImageComponent: any): string {
  var text = collectText(fiber, TextComponent).replace(/\s+/g, ' ').trim();
  var a11y = collectAccessibilityLabel(fiber, ImageComponent);
  return text || a11y || '';
}

/** require('react-native')에서 Text, Image 컴포넌트 추출 */
export function getRNComponents(): { Text: any; Image: any } {
  var rn = typeof require !== 'undefined' && require('react-native');
  return { Text: rn && rn.Text, Image: rn && rn.Image };
}

/** fiber 자신(또는 조상)에서 처음 나오는 testID */
export function getAncestorTestID(fiber: Fiber): string | undefined {
  var f: Fiber | null = fiber;
  while (f && f.memoizedProps) {
    if (typeof f.memoizedProps.testID === 'string' && f.memoizedProps.testID.trim())
      return f.memoizedProps.testID.trim();
    f = f.return;
  }
  return undefined;
}

/** Text fiber 한 노드의 직접 children 문자열만 (자식 Text 노드 제외) */
export function getTextNodeContent(fiber: Fiber, TextComponent: any): string {
  if (!fiber || fiber.type !== TextComponent || !fiber.memoizedProps) return '';
  var c = fiber.memoizedProps.children;
  if (typeof c === 'string') return c.trim();
  if (Array.isArray(c))
    return c
      .map(function (x: any) {
        return typeof x === 'string' ? x : '';
      })
      .join('')
      .trim();
  return '';
}

/** Fiber의 컴포넌트 타입 이름 (displayName/name/문자열) */
export function getFiberTypeName(fiber: Fiber): string {
  if (!fiber || !fiber.type) return 'Unknown';
  var t = fiber.type;
  if (typeof t === 'string') return t;
  if (t.displayName && typeof t.displayName === 'string') return t.displayName;
  if (t.name && typeof t.name === 'string') return t.name;
  return 'Component';
}
