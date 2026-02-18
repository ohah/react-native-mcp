/**
 * render-tracking: 런타임 함수 + MCP 도구 핸들러 단위 테스트
 * - collectRenderEntries (mount/update/bail-out 판별, trigger 분류, 컴포넌트 필터)
 * - startRenderProfile / getRenderReport / clearRenderProfile (MCP API)
 * - start_render_profile / get_render_report / clear_render_profile (MCP 도구 핸들러)
 */

import { GlobalRegistrator } from '@happy-dom/global-registrator';
try {
  await GlobalRegistrator.unregister();
} catch {}

import { describe, expect, it, beforeAll, beforeEach, mock } from 'bun:test';

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
let wrappedOnCommitFiberRoot: (rendererID: number, root: unknown) => void;

beforeAll(async () => {
  const runtimePath = require.resolve('../../runtime.js');
  delete require.cache[runtimePath];
  delete (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;

  await import('../../runtime.js');
  MCP = (globalThis as Record<string, unknown>).__REACT_NATIVE_MCP__ as typeof MCP;

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
  next: MockHook | null;
}

function makeStateHook(value: unknown): MockHook {
  return { memoizedState: value, queue: {}, next: null };
}

function chainHooks(...hooks: MockHook[]): MockHook | null {
  if (hooks.length === 0) return null;
  for (let i = 0; i < hooks.length - 1; i++) {
    hooks[i].next = hooks[i + 1];
  }
  return hooks[0];
}

// ─── Mock Fiber 트리 헬퍼 ────────────────────────────────────────

interface MockFiber {
  tag: number;
  type: unknown;
  memoizedProps: Record<string, unknown>;
  memoizedState: MockHook | null;
  child: MockFiber | null;
  sibling: MockFiber | null;
  return: MockFiber | null;
  alternate: MockFiber | null;
  flags: number;
  dependencies: { firstContext: unknown } | null;
}

function makeFiber(
  type: unknown,
  props: Record<string, unknown>,
  hooks: MockHook | null = null,
  children: MockFiber[] = [],
  options: { flags?: number; tag?: number } = {}
): MockFiber {
  const tag = options.tag ?? (typeof type === 'function' ? 0 : typeof type === 'string' ? 5 : 0);
  const fiber: MockFiber = {
    tag,
    type,
    memoizedProps: props,
    memoizedState: hooks,
    child: null,
    sibling: null,
    return: null,
    alternate: null,
    flags: options.flags ?? 1, // PerformedWork by default
    dependencies: null,
  };
  for (let i = 0; i < children.length; i++) {
    children[i].return = fiber;
    if (i === 0) fiber.child = children[i];
    else children[i - 1].sibling = children[i];
  }
  return fiber;
}

/** MemoComponent(tag=14) 래퍼 생성 — 자식을 memo로 감싸는 효과 */
function makeMemoWrapper(child: MockFiber): MockFiber {
  const wrapper = makeFiber(null, {}, null, [child], { tag: 14 });
  return wrapper;
}

// ─── MCP API 존재 확인 ──────────────────────────────────────────

describe('렌더 프로파일링 — MCP API 존재 확인', () => {
  it('startRenderProfile 함수 존재', () => {
    expect(typeof MCP.startRenderProfile).toBe('function');
  });

  it('getRenderReport 함수 존재', () => {
    expect(typeof MCP.getRenderReport).toBe('function');
  });

  it('clearRenderProfile 함수 존재', () => {
    expect(typeof MCP.clearRenderProfile).toBe('function');
  });
});

// ─── startRenderProfile / clearRenderProfile ─────────────────────

describe('startRenderProfile / clearRenderProfile', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
  });

  it('startRenderProfile은 { started: true } 반환', () => {
    const result = MCP.startRenderProfile() as { started: boolean };
    expect(result.started).toBe(true);
  });

  it('clearRenderProfile은 { cleared: true } 반환', () => {
    MCP.startRenderProfile();
    const result = MCP.clearRenderProfile() as { cleared: boolean };
    expect(result.cleared).toBe(true);
  });

  it('clearRenderProfile 후 리포트가 비어있음', () => {
    MCP.startRenderProfile();
    MCP.clearRenderProfile();
    const report = MCP.getRenderReport() as { profiling: boolean; totalRenders: number };
    expect(report.profiling).toBe(false);
    expect(report.totalRenders).toBe(0);
  });
});

// ─── getRenderReport 기본 구조 ───────────────────────────────────

describe('getRenderReport — 기본 구조', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
  });

  it('프로파일링 시작 전 리포트 필드 존재', () => {
    const report = MCP.getRenderReport() as Record<string, unknown>;
    expect(report.profiling).toBe(false);
    expect(report.totalCommits).toBe(0);
    expect(report.totalRenders).toBe(0);
    expect(Array.isArray(report.hotComponents)).toBe(true);
    expect(typeof report.duration).toBe('string');
  });

  it('프로파일링 시작 후 profiling = true', () => {
    MCP.startRenderProfile();
    const report = MCP.getRenderReport() as { profiling: boolean; startTime: number };
    expect(report.profiling).toBe(true);
    expect(report.startTime).toBeGreaterThan(0);
  });
});

// ─── collectRenderEntries — mount 감지 ───────────────────────────

describe('collectRenderEntries — mount 감지', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
    MCP.startRenderProfile();
  });

  it('alternate 없는 FunctionComponent는 mount로 기록', () => {
    const MyComp = function MyComp() {};
    const fiber = makeFiber(MyComp, {});
    // alternate = null → mount

    wrappedOnCommitFiberRoot(1, { current: fiber });

    const report = MCP.getRenderReport() as {
      totalRenders: number;
      hotComponents: Array<{ name: string; mounts: number; renders: number }>;
    };
    expect(report.totalRenders).toBe(1);
    expect(report.hotComponents).toHaveLength(1);
    expect(report.hotComponents[0].name).toBe('MyComp');
    expect(report.hotComponents[0].mounts).toBe(1);
    expect(report.hotComponents[0].renders).toBe(1);
  });

  it('mount 시 parent 이름이 올바르게 기록', () => {
    const Parent = function ParentComp() {};
    const Child = function ChildComp() {};
    const child = makeFiber(Child, {});
    makeFiber(Parent, {}, null, [child]);

    wrappedOnCommitFiberRoot(1, { current: child.return! });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string; recentRenders: Array<{ parent: string }> }>;
    };
    const childEntry = report.hotComponents.find((c) => c.name === 'ChildComp');
    expect(childEntry).toBeDefined();
    expect(childEntry!.recentRenders[0].parent).toBe('ParentComp');
  });
});

// ─── collectRenderEntries — update & bail-out ────────────────────

describe('collectRenderEntries — update & bail-out', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
    MCP.startRenderProfile();
  });

  it('PerformedWork flag가 있는 update는 기록 (state trigger)', () => {
    const Counter = function Counter() {};
    const prevFiber = makeFiber(Counter, {}, chainHooks(makeStateHook(0)));
    const nextFiber = makeFiber(Counter, {}, chainHooks(makeStateHook(1)), [], { flags: 1 });
    nextFiber.alternate = prevFiber;

    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const report = MCP.getRenderReport() as {
      totalRenders: number;
      hotComponents: Array<{
        name: string;
        triggers: Record<string, number>;
        recentRenders: Array<{ trigger: string; changes?: unknown }>;
      }>;
    };
    expect(report.totalRenders).toBe(1);
    const comp = report.hotComponents[0];
    expect(comp.name).toBe('Counter');
    expect(comp.triggers.state).toBe(1);
    expect(comp.recentRenders[0].trigger).toBe('state');
    // changes에 state 변경 기록
    const changes = comp.recentRenders[0].changes as {
      state: Array<{ hookIndex: number; prev: unknown; next: unknown }>;
    };
    expect(changes.state).toHaveLength(1);
    expect(changes.state[0].hookIndex).toBe(0);
    expect(changes.state[0].prev).toBe(0);
    expect(changes.state[0].next).toBe(1);
  });

  it('PerformedWork flag 없으면 bail-out (기록 안 됨)', () => {
    const Comp = function BailedOut() {};
    const prevFiber = makeFiber(Comp, {}, chainHooks(makeStateHook(42)));
    const nextFiber = makeFiber(Comp, {}, chainHooks(makeStateHook(42)), [], { flags: 0 });
    nextFiber.alternate = prevFiber;

    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const report = MCP.getRenderReport() as { totalRenders: number };
    expect(report.totalRenders).toBe(0);
  });

  it('props 변경은 props trigger로 기록', () => {
    const Item = function Item() {};
    const prevProps = { title: 'old' };
    const nextProps = { title: 'new' };
    const prevFiber = makeFiber(Item, prevProps);
    const nextFiber = makeFiber(Item, nextProps, null, [], { flags: 1 });
    nextFiber.alternate = prevFiber;

    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{
        triggers: Record<string, number>;
        recentRenders: Array<{ trigger: string; changes?: unknown }>;
      }>;
    };
    expect(report.hotComponents[0].triggers.props).toBe(1);
    const changes = report.hotComponents[0].recentRenders[0].changes as {
      props: Array<{ key: string; prev: unknown; next: unknown }>;
    };
    expect(changes.props).toHaveLength(1);
    expect(changes.props[0].key).toBe('title');
    expect(changes.props[0].prev).toBe('old');
    expect(changes.props[0].next).toBe('new');
  });

  it('state/props/context 변경 없으면 parent trigger (불필요 리렌더)', () => {
    const Child = function UnnecessaryChild() {};
    const sharedProps = { x: 1 };
    const prevFiber = makeFiber(Child, sharedProps, chainHooks(makeStateHook('same')));
    const nextFiber = makeFiber(Child, sharedProps, chainHooks(makeStateHook('same')), [], {
      flags: 1,
    });
    nextFiber.alternate = prevFiber;

    wrappedOnCommitFiberRoot(1, { current: nextFiber });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{
        triggers: Record<string, number>;
        unnecessaryRenders: number;
      }>;
    };
    expect(report.hotComponents[0].triggers.parent).toBe(1);
    expect(report.hotComponents[0].unnecessaryRenders).toBe(1);
  });
});

// ─── 컴포넌트 필터 (whitelist / blacklist) ───────────────────────

describe('컴포넌트 필터 — whitelist / blacklist', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
  });

  it('whitelist: 지정된 컴포넌트만 추적', () => {
    MCP.startRenderProfile({ components: ['Counter'] });

    const Counter = function Counter() {};
    const Other = function Other() {};

    const counter = makeFiber(Counter, {});
    const other = makeFiber(Other, {});
    const root = makeFiber('View', {}, null, [counter, other], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      totalRenders: number;
      hotComponents: Array<{ name: string }>;
    };
    expect(report.totalRenders).toBe(1);
    expect(report.hotComponents[0].name).toBe('Counter');
  });

  it('blacklist: 지정된 컴포넌트 제외', () => {
    MCP.startRenderProfile({ ignore: ['NoisyComp'] });

    const NoisyComp = function NoisyComp() {};
    const GoodComp = function GoodComp() {};

    const noisy = makeFiber(NoisyComp, {});
    const good = makeFiber(GoodComp, {});
    const root = makeFiber('View', {}, null, [noisy, good], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string }>;
    };
    const names = report.hotComponents.map((c) => c.name);
    expect(names).toContain('GoodComp');
    expect(names).not.toContain('NoisyComp');
  });

  it('기본 ignore: LogBox 계열은 자동 무시', () => {
    MCP.startRenderProfile();

    const LogBoxButton = function LogBoxButton() {};
    const UserComp = function UserComp() {};

    const logbox = makeFiber(LogBoxButton, {});
    const user = makeFiber(UserComp, {});
    const root = makeFiber('View', {}, null, [logbox, user], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string }>;
    };
    const names = report.hotComponents.map((c) => c.name);
    expect(names).toContain('UserComp');
    expect(names).not.toContain('LogBoxButton');
  });

  it('기본 ignore: PressabilityDebugView 자동 무시', () => {
    MCP.startRenderProfile();

    const PressabilityDebugView = function PressabilityDebugView() {};
    const App = function App() {};

    const press = makeFiber(PressabilityDebugView, {});
    const app = makeFiber(App, {});
    const root = makeFiber('View', {}, null, [press, app], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string }>;
    };
    const names = report.hotComponents.map((c) => c.name);
    expect(names).not.toContain('PressabilityDebugView');
  });

  it('기본 ignore: _LogBox 접두사 변형도 무시', () => {
    MCP.startRenderProfile();

    const _LogBoxContainer = function _LogBoxContainer() {};
    const root = makeFiber('View', {}, null, [makeFiber(_LogBoxContainer, {})], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as { totalRenders: number };
    expect(report.totalRenders).toBe(0);
  });

  it('whitelist가 있으면 기본 ignore를 무시 (LogBox도 추적 가능)', () => {
    MCP.startRenderProfile({ components: ['LogBoxButton'] });

    const LogBoxButton = function LogBoxButton() {};
    const root = makeFiber('View', {}, null, [makeFiber(LogBoxButton, {})], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string }>;
    };
    expect(report.hotComponents[0].name).toBe('LogBoxButton');
  });
});

// ─── isMemoized 감지 ─────────────────────────────────────────────

describe('isMemoized 감지', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
    MCP.startRenderProfile();
  });

  it('MemoComponent(tag=14) 래퍼 아래 자식은 isMemoized = true', () => {
    const MemoChild = function MemoChild() {};
    const child = makeFiber(MemoChild, {});
    const memoWrapper = makeMemoWrapper(child);
    const root = makeFiber('View', {}, null, [memoWrapper], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string; isMemoized: boolean }>;
    };
    const memoComp = report.hotComponents.find((c) => c.name === 'MemoChild');
    expect(memoComp).toBeDefined();
    expect(memoComp!.isMemoized).toBe(true);
  });

  it('일반 컴포넌트는 isMemoized = false', () => {
    const PlainComp = function PlainComp() {};
    const root = makeFiber('View', {}, null, [makeFiber(PlainComp, {})], { tag: 5 });

    wrappedOnCommitFiberRoot(1, { current: root });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string; isMemoized: boolean }>;
    };
    expect(report.hotComponents[0].isMemoized).toBe(false);
  });
});

// ─── 리포트 집계 ─────────────────────────────────────────────────

describe('getRenderReport — 집계 로직', () => {
  beforeEach(() => {
    MCP.clearRenderProfile();
    MCP.startRenderProfile();
  });

  it('여러 커밋의 totalCommits 카운트 정확', () => {
    const Comp = function Comp() {};

    for (let i = 0; i < 3; i++) {
      const prev = makeFiber(Comp, {}, chainHooks(makeStateHook(i)));
      const next = makeFiber(Comp, {}, chainHooks(makeStateHook(i + 1)), [], { flags: 1 });
      next.alternate = prev;
      wrappedOnCommitFiberRoot(1, { current: next });
    }

    const report = MCP.getRenderReport() as { totalCommits: number; totalRenders: number };
    expect(report.totalCommits).toBe(3);
    expect(report.totalRenders).toBe(3);
  });

  it('hotComponents는 renders 내림차순', () => {
    const Hot = function Hot() {};
    const Cold = function Cold() {};

    // Hot: 3번 렌더
    for (let i = 0; i < 3; i++) {
      const prev = makeFiber(Hot, {}, chainHooks(makeStateHook(i)));
      const next = makeFiber(Hot, {}, chainHooks(makeStateHook(i + 1)), [], { flags: 1 });
      next.alternate = prev;
      wrappedOnCommitFiberRoot(1, { current: next });
    }

    // Cold: 1번 렌더 (mount)
    wrappedOnCommitFiberRoot(1, { current: makeFiber(Cold, {}) });

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ name: string; renders: number }>;
    };
    expect(report.hotComponents[0].name).toBe('Hot');
    expect(report.hotComponents[0].renders).toBe(3);
    expect(report.hotComponents[1].name).toBe('Cold');
    expect(report.hotComponents[1].renders).toBe(1);
  });

  it('recentRenders는 최근 5개 유지', () => {
    const Comp = function Freq() {};

    for (let i = 0; i < 8; i++) {
      const prev = makeFiber(Comp, {}, chainHooks(makeStateHook(i)));
      const next = makeFiber(Comp, {}, chainHooks(makeStateHook(i + 1)), [], { flags: 1 });
      next.alternate = prev;
      wrappedOnCommitFiberRoot(1, { current: next });
    }

    const report = MCP.getRenderReport() as {
      hotComponents: Array<{ recentRenders: unknown[] }>;
    };
    expect(report.hotComponents[0].recentRenders).toHaveLength(5);
  });

  it('프로파일링 비활성 시 onCommitFiberRoot로 데이터 수집 안 됨', () => {
    MCP.clearRenderProfile(); // profiling = false

    const Comp = function NoTrack() {};
    wrappedOnCommitFiberRoot(1, { current: makeFiber(Comp, {}) });

    const report = MCP.getRenderReport() as { totalRenders: number };
    expect(report.totalRenders).toBe(0);
  });
});

// ─── MCP 도구 핸들러 테스트 ──────────────────────────────────────

describe('MCP 도구: start_render_profile / get_render_report / clear_render_profile', () => {
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
      sendRequest: mock(() => Promise.resolve({ error: null, result: { started: true } })),
    };
    const { registerRenderTracking } = await import('../tools/render-tracking.js');
    registerRenderTracking(mockServer as never, appSession as never);
  });

  it('세 도구 모두 등록됨', () => {
    expect(handlers['start_render_profile']).toBeDefined();
    expect(handlers['get_render_report']).toBeDefined();
    expect(handlers['clear_render_profile']).toBeDefined();
  });

  it('start_render_profile — 연결 시 시작 메시지 반환', async () => {
    const result = (await handlers['start_render_profile']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('Render profiling started');
    expect(appSession.sendRequest).toHaveBeenCalledTimes(1);
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0].params.code).toContain('startRenderProfile');
  });

  it('start_render_profile — components 파라미터 전달', async () => {
    await handlers['start_render_profile']({ components: ['CartScreen', 'ProductList'] });
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0].params.code).toContain('CartScreen');
    expect(call[0].params.code).toContain('ProductList');
  });

  it('start_render_profile — ignore 파라미터 전달', async () => {
    await handlers['start_render_profile']({ ignore: ['Text', 'Image'] });
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0].params.code).toContain('Text');
    expect(call[0].params.code).toContain('ignore');
  });

  it('get_render_report — 리포트 JSON 반환', async () => {
    const mockReport = {
      profiling: true,
      totalCommits: 5,
      totalRenders: 20,
      hotComponents: [{ name: 'Counter', renders: 10 }],
    };
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: mockReport,
    });

    const result = (await handlers['get_render_report']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('Counter');
    expect(result.content[0].text).toContain('10');
  });

  it('get_render_report — result null이면 안내 메시지', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: null,
    });

    const result = (await handlers['get_render_report']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('start_render_profile first');
  });

  it('clear_render_profile — 성공 메시지 반환', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: true,
    });

    const result = (await handlers['clear_render_profile']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('stopped and data cleared');
  });

  it('연결 안 됐을 때 에러 메시지 반환', async () => {
    appSession.isConnected = () => false;

    for (const tool of ['start_render_profile', 'get_render_report', 'clear_render_profile']) {
      const result = (await handlers[tool]({})) as {
        content: Array<{ type: string; text: string }>;
      };
      expect(result.content[0].text).toContain('No React Native app connected');
    }
    expect(appSession.sendRequest).not.toHaveBeenCalled();
  });

  it('sendRequest 에러 시 에러 텍스트 반환', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: 'Eval timeout',
      result: null,
    });

    const result = (await handlers['start_render_profile']({})) as {
      content: Array<{ type: string; text: string }>;
    };
    expect(result.content[0].text).toContain('Error: Eval timeout');
  });
});
