/**
 * inspect_state / get_state_changes: 런타임 함수 + MCP 도구 핸들러 단위 테스트
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator';
try {
  await GlobalRegistrator.unregister();
} catch {}

import { describe, expect, it, beforeAll, beforeEach, afterAll, mock } from 'bun:test';

// ─── Mock react-native ──────────────────────────────────────────

const MockText = function Text() {};
const MockImage = function Image() {};

mock.module('react-native', () => ({
  AppRegistry: {
    registerComponent: mock(() => {}),
    runApplication: mock((..._args: unknown[]) => {}),
  },
  Text: MockText,
  Image: MockImage,
  NativeModules: { SourceCode: { scriptURL: null } },
}));

(globalThis as Record<string, unknown>).__DEV__ = false;

let MCP: Record<string, (...args: unknown[]) => unknown>;
/** runtime.js가 래핑한 onCommitFiberRoot (state change 수집 포함) */
let wrappedOnCommitFiberRoot: (rendererID: number, root: unknown) => void;

beforeAll(async () => {
  // 모듈 캐시 초기화 + hook 삭제 → runtime.js가 fresh hook 생성 + onCommitFiberRoot 래핑
  const runtimePath = require.resolve('../../runtime.js');
  delete require.cache[runtimePath];
  delete (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;

  await import('../../runtime.js');
  MCP = (globalThis as Record<string, unknown>).__REACT_NATIVE_MCP__ as typeof MCP;

  // 래핑된 onCommitFiberRoot 참조 저장 (setMockFiberRoot로 교체되기 전에)
  const hook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<
    string,
    unknown
  >;
  wrappedOnCommitFiberRoot = hook.onCommitFiberRoot as typeof wrappedOnCommitFiberRoot;
});

// ─── Mock Hook 체인 헬퍼 ─────────────────────────────────────────

interface MockHook {
  memoizedState: unknown;
  queue: object | null;
  create?: unknown;
  next: MockHook | null;
}

/** state hook (useState/useReducer/useSyncExternalStore) 생성 */
function makeStateHook(value: unknown): MockHook {
  return { memoizedState: value, queue: {}, next: null };
}

/** effect hook (useEffect/useLayoutEffect) 생성 */
function makeEffectHook(): MockHook {
  return { memoizedState: null, queue: null, create: () => {}, next: null };
}

/** hook 체인 연결 */
function chainHooks(...hooks: MockHook[]): MockHook | null {
  if (hooks.length === 0) return null;
  for (let i = 0; i < hooks.length - 1; i++) {
    hooks[i].next = hooks[i + 1];
  }
  return hooks[0];
}

// ─── Mock Fiber 트리 헬퍼 (tag 포함) ─────────────────────────────

interface MockStateFiber {
  tag: number;
  type: unknown;
  memoizedProps: Record<string, unknown>;
  memoizedState: MockHook | null;
  child: MockStateFiber | null;
  sibling: MockStateFiber | null;
  return: MockStateFiber | null;
  alternate: MockStateFiber | null;
  stateNode?: unknown;
}

/**
 * tag 자동 설정: function → 0 (FunctionComponent), string → 5 (HostComponent)
 */
function makeStateFiber(
  type: unknown,
  props: Record<string, unknown>,
  hooks: MockHook | null = null,
  children: MockStateFiber[] = []
): MockStateFiber {
  const tag = typeof type === 'function' ? 0 : typeof type === 'string' ? 5 : 0;
  const fiber: MockStateFiber = {
    tag,
    type,
    memoizedProps: props,
    memoizedState: hooks,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
  };
  for (let i = 0; i < children.length; i++) {
    children[i].return = fiber;
    if (i === 0) fiber.child = children[i];
    else children[i - 1].sibling = children[i];
  }
  return fiber;
}

function setMockFiberRoot(rootFiber: MockStateFiber) {
  const fiberRoot = { current: rootFiber };
  const roots = new Set([fiberRoot]);
  (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, {}]]),
    getFiberRoots: (_id: number) => roots,
  };
}

let _originalHook: unknown;

function clearMockFiberRoot() {
  if (_originalHook === undefined) {
    _originalHook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
  }
  delete (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

afterAll(() => {
  if (_originalHook !== undefined) {
    (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = _originalHook;
  }
});

// ─── inspectState 런타임 테스트 ──────────────────────────────────

describe('inspectState — state Hook 인스펙션', () => {
  beforeEach(() => clearMockFiberRoot());

  it('MCP.inspectState 함수가 존재', () => {
    expect(typeof MCP.inspectState).toBe('function');
  });

  it('Fiber root 없으면 null 반환', () => {
    clearMockFiberRoot();
    expect(MCP.inspectState('CartScreen')).toBeNull();
  });

  it('매칭되는 컴포넌트 없으면 null 반환', () => {
    const root = makeStateFiber('View', {});
    setMockFiberRoot(root);
    expect(MCP.inspectState('NonexistentComponent')).toBeNull();
  });

  it('빈 문자열 셀렉터는 null 반환', () => {
    expect(MCP.inspectState('')).toBeNull();
  });

  it('FunctionComponent의 state Hook 추출', () => {
    const CartScreen = function CartScreen() {};
    const hooks = chainHooks(makeStateHook(0), makeStateHook('hello'), makeStateHook([1, 2, 3]));
    const root = makeStateFiber('View', {}, null, [
      makeStateFiber(CartScreen, { testID: 'cart' }, hooks),
    ]);
    setMockFiberRoot(root);

    const result = MCP.inspectState('#cart') as {
      component: string;
      hooks: Array<{ index: number; type: string; value: unknown }>;
    };
    expect(result).not.toBeNull();
    expect(result.component).toBe('CartScreen');
    expect(result.hooks).toHaveLength(3);
    expect(result.hooks[0]).toEqual({ index: 0, type: 'state', value: 0 });
    expect(result.hooks[1]).toEqual({ index: 1, type: 'state', value: 'hello' });
    expect(result.hooks[2]).toEqual({ index: 2, type: 'state', value: [1, 2, 3] });
  });

  it('effect Hook은 필터링되어 반환하지 않음', () => {
    const MyComp = function MyComp() {};
    const hooks = chainHooks(
      makeStateHook(42),
      makeEffectHook(), // useEffect — 제외됨
      makeStateHook('visible')
    );
    const root = makeStateFiber('View', {}, null, [
      makeStateFiber(MyComp, { testID: 'my-comp' }, hooks),
    ]);
    setMockFiberRoot(root);

    const result = MCP.inspectState('#my-comp') as {
      component: string;
      hooks: Array<{ index: number; type: string; value: unknown }>;
    };
    expect(result).not.toBeNull();
    expect(result.hooks).toHaveLength(2);
    expect(result.hooks[0]).toEqual({ index: 0, type: 'state', value: 42 });
    // effect는 index 1이지만 건너뜀 → state hook의 원래 index(2) 유지
    expect(result.hooks[1]).toEqual({ index: 2, type: 'state', value: 'visible' });
  });

  it('host fiber(View) 매칭 시 가장 가까운 조상 FunctionComponent의 Hook 반환', () => {
    const ParentComp = function ParentComp() {};
    const hooks = chainHooks(makeStateHook(true), makeStateHook({ count: 5 }));
    const root = makeStateFiber(ParentComp, {}, hooks, [
      makeStateFiber('View', { testID: 'inner-view' }),
    ]);
    setMockFiberRoot(root);

    const result = MCP.inspectState('#inner-view') as {
      component: string;
      hooks: Array<{ index: number; type: string; value: unknown }>;
    };
    expect(result).not.toBeNull();
    expect(result.component).toBe('ParentComp');
    expect(result.hooks).toHaveLength(2);
    expect(result.hooks[0].value).toBe(true);
    expect(result.hooks[1].value).toEqual({ count: 5 });
  });

  it('Hook이 없는 FunctionComponent는 빈 hooks 배열 반환', () => {
    const EmptyComp = function EmptyComp() {};
    const root = makeStateFiber('View', {}, null, [
      makeStateFiber(EmptyComp, { testID: 'empty' }, null),
    ]);
    setMockFiberRoot(root);

    const result = MCP.inspectState('#empty') as {
      component: string;
      hooks: Array<{ index: number; type: string; value: unknown }>;
    };
    expect(result).not.toBeNull();
    expect(result.component).toBe('EmptyComp');
    expect(result.hooks).toEqual([]);
  });

  it('displayName이 설정된 컴포넌트도 올바르게 표시', () => {
    const Wrapped = function () {};
    (Wrapped as { displayName?: string }).displayName = 'Animated.CartScreen';
    const hooks = chainHooks(makeStateHook(99));
    const root = makeStateFiber('View', {}, null, [
      makeStateFiber(Wrapped, { testID: 'animated' }, hooks),
    ]);
    setMockFiberRoot(root);

    const result = MCP.inspectState('#animated') as {
      component: string;
      hooks: Array<{ index: number; type: string; value: unknown }>;
    };
    expect(result).not.toBeNull();
    expect(result.component).toBe('Animated.CartScreen');
    expect(result.hooks[0].value).toBe(99);
  });

  it('객체/배열 state 값의 안전한 직렬화 (순환 참조 방지)', () => {
    const Comp = function Comp() {};
    const circular: Record<string, unknown> = { a: 1 };
    circular.self = circular;
    const hooks = chainHooks(makeStateHook(circular));
    const root = makeStateFiber('View', {}, null, [
      makeStateFiber(Comp, { testID: 'circular' }, hooks),
    ]);
    setMockFiberRoot(root);

    const result = MCP.inspectState('#circular') as {
      component: string;
      hooks: Array<{ index: number; type: string; value: unknown }>;
    };
    expect(result).not.toBeNull();
    expect(result.hooks).toHaveLength(1);
    // 순환 참조가 '[Circular]'로 대체되어야 함
    const val = result.hooks[0].value as Record<string, unknown>;
    expect(val.a).toBe(1);
    expect(val.self).toBe('[Circular]');
  });
});

// ─── getStateChanges / clearStateChanges 런타임 테스트 ────────────

describe('getStateChanges / clearStateChanges — 상태 변경 이력', () => {
  beforeEach(() => {
    MCP.clearStateChanges();
  });

  it('MCP.getStateChanges / clearStateChanges 함수가 존재', () => {
    expect(typeof MCP.getStateChanges).toBe('function');
    expect(typeof MCP.clearStateChanges).toBe('function');
  });

  it('초기 상태에서 빈 배열 반환', () => {
    const changes = MCP.getStateChanges() as unknown[];
    expect(changes).toEqual([]);
  });

  it('onCommitFiberRoot로 state 변경 수집', () => {
    const Counter = function Counter() {};

    // 이전 fiber (count = 0)
    const prevFiber = makeStateFiber(Counter, {}, chainHooks(makeStateHook(0)));

    // 현재 fiber (count = 1), alternate = 이전
    const nextFiber = makeStateFiber(Counter, {}, chainHooks(makeStateHook(1)));
    nextFiber.alternate = prevFiber;

    // onCommitFiberRoot 트리거
    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const changes = MCP.getStateChanges() as Array<{
      id: number;
      timestamp: number;
      component: string;
      hookIndex: number;
      prev: unknown;
      next: unknown;
    }>;
    expect(changes).toHaveLength(1);
    expect(changes[0].component).toBe('Counter');
    expect(changes[0].hookIndex).toBe(0);
    expect(changes[0].prev).toBe(0);
    expect(changes[0].next).toBe(1);
    expect(typeof changes[0].id).toBe('number');
    expect(typeof changes[0].timestamp).toBe('number');
  });

  it('동일한 값이면 변경으로 기록하지 않음', () => {
    const Comp = function Comp() {};
    const prevFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook(42)));
    const nextFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook(42)));
    nextFiber.alternate = prevFiber;

    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const changes = MCP.getStateChanges() as unknown[];
    expect(changes).toHaveLength(0);
  });

  it('여러 Hook 변경을 각각 기록', () => {
    const Form = function Form() {};
    const prevFiber = makeStateFiber(
      Form,
      {},
      chainHooks(makeStateHook(''), makeStateHook(false), makeStateHook(0))
    );
    const nextFiber = makeStateFiber(
      Form,
      {},
      chainHooks(makeStateHook('hello'), makeStateHook(true), makeStateHook(0)) // 마지막은 동일
    );
    nextFiber.alternate = prevFiber;

    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const changes = MCP.getStateChanges() as Array<{
      hookIndex: number;
      prev: unknown;
      next: unknown;
    }>;
    expect(changes).toHaveLength(2);
    expect(changes[0].hookIndex).toBe(0);
    expect(changes[0].prev).toBe('');
    expect(changes[0].next).toBe('hello');
    expect(changes[1].hookIndex).toBe(1);
    expect(changes[1].prev).toBe(false);
    expect(changes[1].next).toBe(true);
  });

  it('자식 컴포넌트의 변경도 수집', () => {
    const Parent = function Parent() {};
    const Child = function Child() {};

    const prevChild = makeStateFiber(Child, {}, chainHooks(makeStateHook('a')));
    const prevParent = makeStateFiber(Parent, {}, chainHooks(makeStateHook(1)), [prevChild]);

    const nextChild = makeStateFiber(Child, {}, chainHooks(makeStateHook('b')));
    nextChild.alternate = prevChild;
    const nextParent = makeStateFiber(Parent, {}, chainHooks(makeStateHook(2)), [nextChild]);
    nextParent.alternate = prevParent;

    wrappedOnCommitFiberRoot(1, { current: nextParent });

    const changes = MCP.getStateChanges() as Array<{
      component: string;
      prev: unknown;
      next: unknown;
    }>;
    expect(changes).toHaveLength(2);
    const parentChange = changes.find((c) => c.component === 'Parent');
    const childChange = changes.find((c) => c.component === 'Child');
    expect(parentChange).toBeDefined();
    expect(parentChange!.prev).toBe(1);
    expect(parentChange!.next).toBe(2);
    expect(childChange).toBeDefined();
    expect(childChange!.prev).toBe('a');
    expect(childChange!.next).toBe('b');
  });

  it('component 필터', () => {
    const A = function CompA() {};
    const B = function CompB() {};

    // CompA 변경
    const prevA = makeStateFiber(A, {}, chainHooks(makeStateHook(0)));
    const nextA = makeStateFiber(A, {}, chainHooks(makeStateHook(1)));
    nextA.alternate = prevA;
    wrappedOnCommitFiberRoot(1, { current: nextA });

    // CompB 변경
    const prevB = makeStateFiber(B, {}, chainHooks(makeStateHook('x')));
    const nextB = makeStateFiber(B, {}, chainHooks(makeStateHook('y')));
    nextB.alternate = prevB;
    wrappedOnCommitFiberRoot(1, { current: nextB });

    const filtered = MCP.getStateChanges({ component: 'CompA' }) as Array<{
      component: string;
    }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].component).toBe('CompA');
  });

  it('since 타임스탬프 필터', async () => {
    const Comp = function Comp() {};

    const prev1 = makeStateFiber(Comp, {}, chainHooks(makeStateHook(0)));
    const next1 = makeStateFiber(Comp, {}, chainHooks(makeStateHook(1)));
    next1.alternate = prev1;
    wrappedOnCommitFiberRoot(1, { current: next1 });

    const midpoint = Date.now();
    await new Promise((r) => setTimeout(r, 5));

    const prev2 = makeStateFiber(Comp, {}, chainHooks(makeStateHook(1)));
    const next2 = makeStateFiber(Comp, {}, chainHooks(makeStateHook(2)));
    next2.alternate = prev2;
    wrappedOnCommitFiberRoot(1, { current: next2 });

    const filtered = MCP.getStateChanges({ since: midpoint }) as Array<{ next: unknown }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0].next).toBe(2);
  });

  it('limit 옵션으로 최대 반환 수 제한', () => {
    const Comp = function Comp() {};
    for (let i = 0; i < 10; i++) {
      const prev = makeStateFiber(Comp, {}, chainHooks(makeStateHook(i)));
      const next = makeStateFiber(Comp, {}, chainHooks(makeStateHook(i + 1)));
      next.alternate = prev;
      wrappedOnCommitFiberRoot(1, { current: next });
    }

    const limited = MCP.getStateChanges({ limit: 3 }) as Array<{ next: unknown }>;
    expect(limited).toHaveLength(3);
    // 최근 3개 반환 (slice from end)
    expect(limited[0].next).toBe(8);
    expect(limited[2].next).toBe(10);
  });

  it('clearStateChanges 후 빈 배열', () => {
    const Comp = function Comp() {};
    const prev = makeStateFiber(Comp, {}, chainHooks(makeStateHook(0)));
    const next = makeStateFiber(Comp, {}, chainHooks(makeStateHook(1)));
    next.alternate = prev;
    wrappedOnCommitFiberRoot(1, { current: next });

    expect((MCP.getStateChanges() as unknown[]).length).toBeGreaterThan(0);
    MCP.clearStateChanges();
    expect(MCP.getStateChanges()).toEqual([]);
  });

  it('버퍼 크기 제한 (300개 초과 시 oldest 제거)', () => {
    const Comp = function Comp() {};
    for (let i = 0; i < 310; i++) {
      const prev = makeStateFiber(Comp, {}, chainHooks(makeStateHook(i)));
      const next = makeStateFiber(Comp, {}, chainHooks(makeStateHook(i + 1)));
      next.alternate = prev;
      wrappedOnCommitFiberRoot(1, { current: next });
    }

    const all = MCP.getStateChanges({ limit: 500 }) as Array<{ next: unknown }>;
    expect(all).toHaveLength(300);
    // 첫 10개가 제거됨
    expect(all[0].next).toBe(11);
    expect(all[299].next).toBe(310);
  });

  it('얕은 비교 — 참조 동일 객체는 변경으로 기록하지 않음', () => {
    const Comp = function Comp() {};
    const sharedObj = { a: 1, b: 2 };
    const prevFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook(sharedObj)));
    const nextFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook(sharedObj))); // 같은 참조
    nextFiber.alternate = prevFiber;
    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    expect(MCP.getStateChanges()).toEqual([]);
  });

  it('얕은 비교 — 같은 키/값 객체도 변경으로 기록하지 않음', () => {
    const Comp = function Comp() {};
    const prevFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook({ a: 1, b: 2 })));
    const nextFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook({ a: 1, b: 2 })));
    nextFiber.alternate = prevFiber;
    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    expect(MCP.getStateChanges()).toEqual([]);
  });

  it('얕은 비교 — 키가 다른 객체는 변경으로 기록', () => {
    const Comp = function Comp() {};
    const prevFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook({ a: 1 })));
    const nextFiber = makeStateFiber(Comp, {}, chainHooks(makeStateHook({ a: 1, b: 2 })));
    nextFiber.alternate = prevFiber;
    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const changes = MCP.getStateChanges() as unknown[];
    expect(changes).toHaveLength(1);
  });
});

// ─── MCP 도구 inspect_state 핸들러 테스트 ────────────────────────

describe('inspect_state 도구', () => {
  let lastHandler: (args: unknown) => Promise<unknown>;
  let appSession: {
    isConnected: (deviceId?: string, platform?: string) => boolean;
    sendRequest: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    lastHandler = async () => ({ content: [] });
    const mockServer = {
      registerTool(name: string, _def: unknown, handler: (args: unknown) => Promise<unknown>) {
        if (name === 'inspect_state') lastHandler = handler;
      },
    };
    appSession = {
      isConnected: () => true,
      sendRequest: mock(() =>
        Promise.resolve({
          error: null,
          result: {
            component: 'CartScreen',
            hooks: [
              { index: 0, type: 'state', value: 3 },
              { index: 1, type: 'state', value: [{ id: 1 }] },
            ],
          },
        })
      ),
    };
    const { registerInspectState } = await import('../tools/inspect-state.js');
    registerInspectState(mockServer as never, appSession as never);
  });

  it('연결됐을 때 sendRequest 호출하고 Hook 목록 반환', async () => {
    const result = (await lastHandler({ selector: 'CartScreen' })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('CartScreen');
    expect(result.content[0].text).toContain('State hooks: 2');
    expect(appSession.sendRequest).toHaveBeenCalledTimes(1);
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0]).toEqual({
      method: 'eval',
      params: { code: expect.stringContaining('inspectState') },
    });
  });

  it('연결 안 됐을 때 에러 메시지 반환', async () => {
    appSession.isConnected = () => false;
    const result = (await lastHandler({ selector: 'X' })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('No React Native app connected');
    expect(appSession.sendRequest).not.toHaveBeenCalled();
  });

  it('컴포넌트 없으면 not found 메시지 반환', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: null,
    });
    const result = (await lastHandler({ selector: 'Nonexistent' })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('No component found');
  });

  it('sendRequest 에러 시 에러 텍스트 반환', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: 'Eval timeout',
      result: null,
    });
    const result = (await lastHandler({ selector: 'X' })) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('Error: Eval timeout');
  });
});

// ─── MCP 도구 get_state_changes / clear_state_changes 핸들러 테스트 ──

describe('get_state_changes / clear_state_changes 도구', () => {
  let handlers: Record<string, (args: unknown) => Promise<unknown>>;
  let appSession: {
    isConnected: (deviceId?: string, platform?: string) => boolean;
    sendRequest: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    handlers = {};
    const mockServer = {
      registerTool(name: string, _def: unknown, handler: (args: unknown) => Promise<unknown>) {
        handlers[name] = handler;
      },
    };
    appSession = {
      isConnected: () => true,
      sendRequest: mock(() =>
        Promise.resolve({
          error: null,
          result: [
            {
              id: 1,
              timestamp: 1700000000000,
              component: 'Counter',
              hookIndex: 0,
              prev: 0,
              next: 1,
            },
          ],
        })
      ),
    };
    const { registerGetStateChanges } = await import('../tools/get-state-changes.js');
    registerGetStateChanges(mockServer as never, appSession as never);
  });

  it('get_state_changes, clear_state_changes 두 도구 모두 등록', () => {
    expect(handlers['get_state_changes']).toBeDefined();
    expect(handlers['clear_state_changes']).toBeDefined();
  });

  it('get_state_changes — 연결됐을 때 변경 목록 포맷팅 반환', async () => {
    const result = (await handlers['get_state_changes']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content).toHaveLength(1);
    expect(result.content[0].text).toContain('1 state change(s)');
    expect(result.content[0].text).toContain('Counter');
    expect(result.content[0].text).toContain('hook 0');
    expect(result.content[0].text).toContain('→');
    expect(appSession.sendRequest).toHaveBeenCalledTimes(1);
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0].params.code).toContain('getStateChanges');
  });

  it('get_state_changes — component 필터 전달', async () => {
    await handlers['get_state_changes']({ component: 'Counter' });
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0].params.code).toContain('"component":"Counter"');
  });

  it('get_state_changes — 빈 결과 시 안내 메시지', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: [],
    });
    const result = (await handlers['get_state_changes']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('No state changes recorded');
  });

  it('get_state_changes — 연결 안 됐을 때 에러 메시지', async () => {
    appSession.isConnected = () => false;
    const result = (await handlers['get_state_changes']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('No React Native app connected');
  });

  it('clear_state_changes — 성공 메시지 반환', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: true,
    });
    const result = (await handlers['clear_state_changes']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('State changes cleared');
  });

  it('clear_state_changes — 연결 안 됐을 때 에러 메시지', async () => {
    appSession.isConnected = () => false;
    const result = (await handlers['clear_state_changes']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('No React Native app connected');
  });
});
