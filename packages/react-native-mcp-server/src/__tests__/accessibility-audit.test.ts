/**
 * accessibility_audit: 런타임 getAccessibilityAudit + MCP 도구 핸들러 단위 테스트
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

beforeAll(async () => {
  await import('../../runtime.js');
  MCP = (globalThis as Record<string, unknown>).__REACT_NATIVE_MCP__ as typeof MCP;
});

// ─── Mock Fiber 트리 헬퍼 ────────────────────────────────────────

interface MockFiber {
  type: unknown;
  memoizedProps: Record<string, unknown>;
  child: MockFiber | null;
  sibling: MockFiber | null;
  return: MockFiber | null;
  stateNode?: unknown;
}

function makeFiber(
  type: unknown,
  props: Record<string, unknown>,
  children: MockFiber[] = []
): MockFiber {
  const fiber: MockFiber = { type, memoizedProps: props, child: null, sibling: null, return: null };
  for (let i = 0; i < children.length; i++) {
    children[i].return = fiber;
    if (i === 0) fiber.child = children[i];
    else children[i - 1].sibling = children[i];
  }
  return fiber;
}

function setMockFiberRoot(rootFiber: MockFiber) {
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

// ─── 런타임 getAccessibilityAudit 테스트 ───────────────────────────

describe('getAccessibilityAudit — pressable-needs-label', () => {
  beforeEach(() => clearMockFiberRoot());

  it('onPress만 있고 accessibilityLabel·텍스트 없으면 error 위반', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {}, testID: 'bare-btn' }),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{
      rule: string;
      selector: string;
      severity: string;
      message: string;
    }>;
    const v = violations.find((x) => x.rule === 'pressable-needs-label');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('error');
    expect(v!.selector).toBe('#bare-btn');
    expect(v!.message).toContain('accessibilityLabel');
  });

  it('accessibilityLabel 있으면 pressable-needs-label 없음', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {}, accessibilityLabel: '닫기', testID: 'close' }),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{ rule: string }>;
    expect(violations.filter((x) => x.rule === 'pressable-needs-label')).toHaveLength(0);
  });

  it('자식 Text에 텍스트 있으면 pressable-needs-label 없음', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: '제출' })]),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{ rule: string }>;
    expect(violations.filter((x) => x.rule === 'pressable-needs-label')).toHaveLength(0);
  });
});

describe('getAccessibilityAudit — image-needs-alt', () => {
  beforeEach(() => clearMockFiberRoot());

  it('Image에 accessibilityLabel 없으면 error 위반', () => {
    const root = makeFiber('View', {}, [makeFiber(MockImage, { testID: 'hero-img' })]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{
      rule: string;
      selector: string;
      severity: string;
    }>;
    const v = violations.find((x) => x.rule === 'image-needs-alt');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('error');
    expect(v!.selector).toBe('#hero-img');
  });

  it('Image에 accessibilityLabel 있으면 image-needs-alt 없음', () => {
    const root = makeFiber('View', {}, [
      makeFiber(MockImage, { accessibilityLabel: '배너', testID: 'banner' }),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{ rule: string }>;
    expect(violations.filter((x) => x.rule === 'image-needs-alt')).toHaveLength(0);
  });
});

describe('getAccessibilityAudit — missing-role', () => {
  beforeEach(() => clearMockFiberRoot());

  it('onPress 있는데 accessibilityRole 없으면 warning 위반', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {}, accessibilityLabel: '확인', testID: 'ok' }),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{
      rule: string;
      severity: string;
    }>;
    const v = violations.find((x) => x.rule === 'missing-role');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('warning');
  });

  it('accessibilityRole 있으면 missing-role 없음', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', {
        onPress: () => {},
        accessibilityLabel: '제출',
        accessibilityRole: 'button',
        testID: 'submit',
      }),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{ rule: string }>;
    expect(violations.filter((x) => x.rule === 'missing-role')).toHaveLength(0);
  });
});

describe('getAccessibilityAudit — touch-target-size', () => {
  beforeEach(() => clearMockFiberRoot());

  it('measureViewSync가 44 미만 크기 반환 시 warning 위반', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', {
        onPress: () => {},
        accessibilityLabel: '작은 버튼',
        testID: 'small-btn',
      }),
    ]);
    setMockFiberRoot(root);
    const original = MCP.measureViewSync;
    (MCP as { measureViewSync: (uid: string) => unknown }).measureViewSync = () => ({
      width: 32,
      height: 28,
      pageX: 0,
      pageY: 0,
      x: 0,
      y: 0,
    });
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{
      rule: string;
      selector: string;
      severity: string;
      message: string;
    }>;
    (MCP as { measureViewSync: typeof original }).measureViewSync = original;
    const v = violations.find((x) => x.rule === 'touch-target-size');
    expect(v).toBeDefined();
    expect(v!.severity).toBe('warning');
    expect(v!.selector).toBe('#small-btn');
    expect(v!.message).toMatch(/44|32|28/);
  });

  it('measureViewSync가 44 이상 반환 시 touch-target-size 없음', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', {
        onPress: () => {},
        accessibilityLabel: '큰 버튼',
        testID: 'big-btn',
      }),
    ]);
    setMockFiberRoot(root);
    const original = MCP.measureViewSync;
    (MCP as { measureViewSync: (uid: string) => unknown }).measureViewSync = () => ({
      width: 48,
      height: 48,
      pageX: 0,
      pageY: 0,
      x: 0,
      y: 0,
    });
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{ rule: string }>;
    (MCP as { measureViewSync: typeof original }).measureViewSync = original;
    expect(violations.filter((x) => x.rule === 'touch-target-size')).toHaveLength(0);
  });
});

describe('getAccessibilityAudit — 기타', () => {
  beforeEach(() => clearMockFiberRoot());

  it('Fiber root 없으면 빈 배열 반환', () => {
    clearMockFiberRoot();
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as unknown[];
    expect(violations).toEqual([]);
  });

  it('maxDepth 초과 노드는 검사하지 않음', () => {
    function deepTree(d: number): MockFiber {
      if (d >= 5) {
        return makeFiber('Pressable', { onPress: () => {} });
      }
      return makeFiber('View', {}, [deepTree(d + 1)]);
    }
    const root = deepTree(0);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 2 }) as Array<{ rule: string }>;
    expect(violations.length).toBe(0);
  });

  it('selector: testID 있으면 #testID, 없으면 Type@path', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {}, testID: 'with-id' }),
      makeFiber('Pressable', { onPress: () => {} }),
    ]);
    setMockFiberRoot(root);
    const violations = MCP.getAccessibilityAudit({ maxDepth: 10 }) as Array<{
      rule: string;
      selector: string;
    }>;
    const withId = violations.find((v) => v.selector === '#with-id');
    const withPath = violations.find((v) => v.selector.startsWith('Pressable@'));
    expect(withId).toBeDefined();
    expect(withPath).toBeDefined();
  });
});

// ─── MCP 도구 accessibility_audit 핸들러 테스트 ───────────────────

describe('accessibility_audit 도구', () => {
  let mockServer: {
    registerTool: (
      name: string,
      def: unknown,
      handler: (args: unknown) => Promise<unknown>
    ) => void;
  };
  let lastHandler: (args: unknown) => Promise<unknown>;
  let appSession: {
    isConnected: (deviceId?: string, platform?: string) => boolean;
    sendRequest: ReturnType<typeof mock>;
  };

  beforeEach(async () => {
    lastHandler = async () => ({ content: [] });
    mockServer = {
      registerTool(name: string, _def: unknown, handler: (args: unknown) => Promise<unknown>) {
        expect(name).toBe('accessibility_audit');
        lastHandler = handler;
      },
    };
    appSession = {
      isConnected: () => true,
      sendRequest: mock(() =>
        Promise.resolve({
          error: null,
          result: [
            { rule: 'pressable-needs-label', selector: '#btn', severity: 'error', message: 'test' },
          ],
        })
      ),
    };
    const { registerAccessibilityAudit } = await import('../tools/accessibility-audit.js');
    registerAccessibilityAudit(mockServer as never, appSession as never);
  });

  it('연결됐을 때 sendRequest 호출하고 위반 배열 JSON 반환', async () => {
    const result = (await lastHandler({})) as { content: Array<{ type: string; text: string }> };
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    const parsed = JSON.parse(result.content[0].text) as Array<{ rule: string; selector: string }>;
    expect(parsed).toHaveLength(1);
    expect(parsed[0].rule).toBe('pressable-needs-label');
    expect(parsed[0].selector).toBe('#btn');
    expect(appSession.sendRequest).toHaveBeenCalledTimes(1);
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0]).toEqual({
      method: 'eval',
      params: { code: expect.stringContaining('getAccessibilityAudit') },
    });
    expect(call[0].params.code).toContain('maxDepth: 999');
  });

  it('maxDepth 인자 전달 시 eval 코드에 해당 값 포함', async () => {
    await lastHandler({ maxDepth: 30 });
    const call = (appSession.sendRequest as ReturnType<typeof mock>).mock.calls[0];
    expect(call[0].params.code).toContain('maxDepth: 30');
  });

  it('연결 안 됐을 때 에러 메시지 반환', async () => {
    appSession.isConnected = () => false;
    const result = (await lastHandler({})) as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain('No React Native app connected');
    expect(appSession.sendRequest).not.toHaveBeenCalled();
  });

  it('sendRequest가 res.error 반환 시 에러 텍스트 반환', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: 'Eval timeout',
      result: null,
    });
    const result = (await lastHandler({})) as { content: Array<{ type: string; text: string }> };
    expect(result.content[0].text).toContain('Error: Eval timeout');
  });

  it('res.result가 배열이 아니면 빈 배열로 직렬화', async () => {
    (appSession.sendRequest as ReturnType<typeof mock>).mockResolvedValueOnce({
      error: null,
      result: null,
    });
    const result = (await lastHandler({})) as { content: Array<{ type: string; text: string }> };
    const parsed = JSON.parse(result.content[0].text) as unknown[];
    expect(parsed).toEqual([]);
  });
});
