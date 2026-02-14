import { GlobalRegistrator } from '@happy-dom/global-registrator';
try {
  await GlobalRegistrator.unregister();
} catch {}

import { describe, expect, it, beforeAll, beforeEach, mock } from 'bun:test';

// ─── Mock react-native ──────────────────────────────────────────

const MockText = function Text() {};
const MockImage = function Image() {};
const mockRegisterComponent = mock(() => {});
const mockRunApplication = mock((..._args: unknown[]) => {});

mock.module('react-native', () => ({
  AppRegistry: {
    registerComponent: mockRegisterComponent,
    runApplication: mockRunApplication,
  },
  Text: MockText,
  Image: MockImage,
  NativeModules: { SourceCode: { scriptURL: null } },
}));

// __DEV__ false → WebSocket 연결 스킵
(globalThis as Record<string, unknown>).__DEV__ = false;

// MCP 객체 참조
let MCP: Record<string, (...args: unknown[]) => unknown>;

beforeAll(async () => {
  // runtime.js 로드 → globalThis.__REACT_NATIVE_MCP__ 설정
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

/** hook.getFiberRoots(1) 기반 mock DevTools hook 설정 */
function setMockFiberRoot(rootFiber: MockFiber) {
  const fiberRoot = { current: rootFiber };
  const roots = new Set([fiberRoot]);
  (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
    renderers: new Map([[1, {}]]),
    getFiberRoots: (_id: number) => roots,
  };
}

function clearMockFiberRoot() {
  delete (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__;
}

// ─── 테스트 ─────────────────────────────────────────────────────

describe('runtime.js MCP 객체', () => {
  it('globalThis.__REACT_NATIVE_MCP__ 가 존재', () => {
    expect(MCP).toBeDefined();
  });

  it('모든 필수 함수가 존재', () => {
    const requiredFunctions = [
      // 기본
      'registerComponent',
      'registerPressHandler',
      'triggerPress',
      'getRegisteredPressTestIDs',
      // Fiber 기반
      'getClickables',
      'getTextNodes',
      'getComponentTree',
      'pressByLabel',
      // WebView
      'registerWebView',
      'unregisterWebView',
      'clickInWebView',
      'evaluateInWebView',
      'getRegisteredWebViewIds',
      // Scroll
      'registerScrollRef',
      'unregisterScrollRef',
      'scrollTo',
      'getRegisteredScrollTestIDs',
      // 기타
      'enable',
    ];
    for (const fn of requiredFunctions) {
      expect(typeof MCP[fn]).toBe('function');
    }
  });
});

describe('__REACT_DEVTOOLS_GLOBAL_HOOK__ 설정 (복구된 DevTools hook 주입)', () => {
  it('runtime 로드 후 DevTools hook이 존재', () => {
    const hook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<
      string,
      unknown
    >;
    // hook이 존재하는지 (runtime이 설정했거나 이미 있었거나)
    expect(hook).toBeDefined();
  });

  it('hook에 Fiber 지원 API가 있음 (supportsFiber, inject, onCommitFiberRoot, getFiberRoots)', () => {
    const hook = (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ as Record<
      string,
      unknown
    >;
    expect(hook).toBeDefined();
    expect(hook.supportsFiber).toBe(true);
    expect(typeof hook.inject).toBe('function');
    expect(typeof hook.onCommitFiberRoot).toBe('function');
    expect(typeof hook.getFiberRoots).toBe('function');
  });
});

describe('getTextNodes — Text 노드 내용 수집', () => {
  beforeEach(() => clearMockFiberRoot());

  it('hook 없으면 빈 배열', () => {
    clearMockFiberRoot();
    const result = MCP.getTextNodes() as Array<{ text: string; testID?: string }>;
    expect(result).toEqual([]);
  });

  it('onPress 없는 Text 노드도 수집', () => {
    const root = makeFiber('View', {}, [
      makeFiber(MockText, { children: 'Hello' }),
      makeFiber(MockText, { children: 'World' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.getTextNodes() as Array<{ text: string; testID?: string }>;
    expect(result.length).toBe(2);
    expect(result[0].text).toBe('Hello');
    expect(result[1].text).toBe('World');
  });

  it('조상 testID 있으면 testID 포함', () => {
    const root = makeFiber('View', { testID: 'screen' }, [
      makeFiber(MockText, { children: 'Title' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.getTextNodes() as Array<{ text: string; testID?: string }>;
    expect(result.length).toBe(1);
    expect(result[0].text).toBe('Title');
    expect(result[0].testID).toBe('screen');
  });
});

describe('getComponentTree — 컴포넌트 트리 스냅샷', () => {
  beforeEach(() => clearMockFiberRoot());

  it('hook 없으면 null', () => {
    clearMockFiberRoot();
    expect(MCP!.getComponentTree!({})).toBeNull();
  });

  it('루트·자식 타입·testID·text 포함', () => {
    const root = makeFiber('View', { testID: 'screen' }, [
      makeFiber('ScrollView', {}, [makeFiber(MockText, { children: 'Hello' })]),
    ]);
    setMockFiberRoot(root);
    const tree = MCP.getComponentTree({}) as {
      uid: string;
      type: string;
      testID?: string;
      children?: Array<{ uid: string; type: string; text?: string; children?: unknown[] }>;
    };
    expect(tree).not.toBeNull();
    expect(tree.uid).toBe('screen');
    expect(tree.type).toBe('View');
    expect(tree.testID).toBe('screen');
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].type).toBe('ScrollView');
    expect(tree.children![0].children).toHaveLength(1);
    expect(tree.children![0].children![0].type).toBe('Text');
    expect((tree.children![0].children![0] as { text?: string }).text).toBe('Hello');
  });

  it('testID 없으면 uid가 경로', () => {
    const root = makeFiber('View', {}, [makeFiber(MockText, { children: 'A' })]);
    setMockFiberRoot(root);
    const tree = MCP.getComponentTree({}) as { uid: string; children?: Array<{ uid: string }> };
    expect(tree.uid).toBe('0');
    expect(tree.children).toHaveLength(1);
    expect(tree.children![0].uid).toBe('0.0');
  });

  it('maxDepth 초과 시 하위 생략', () => {
    const root = makeFiber('View', {}, [
      makeFiber('View', {}, [makeFiber('View', {}, [makeFiber(MockText, { children: 'Deep' })])]),
    ]);
    setMockFiberRoot(root);
    const tree = MCP.getComponentTree({ maxDepth: 2 }) as { children?: unknown[] };
    expect(tree.children).toHaveLength(1);
    const level1 = tree.children![0] as { children?: unknown[] };
    expect(level1.children).toHaveLength(1);
    const level2 = level1.children![0] as { children?: unknown[] };
    expect(level2.children).toBeUndefined();
  });
});

describe('pressByLabel — onPress 호출', () => {
  beforeEach(() => clearMockFiberRoot());

  it('라벨 일치 시 onPress 호출 + true 반환', () => {
    let pressed = false;
    const root = makeFiber(
      'Pressable',
      {
        onPress: () => {
          pressed = true;
        },
      },
      [makeFiber(MockText, { children: 'Submit' })]
    );
    setMockFiberRoot(root);

    const result = MCP.pressByLabel('Submit');
    expect(result).toBe(true);
    expect(pressed).toBe(true);
  });

  it('라벨 불일치 시 false 반환', () => {
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockText, { children: 'Submit' }),
    ]);
    setMockFiberRoot(root);

    const result = MCP.pressByLabel('Cancel');
    expect(result).toBe(false);
  });

  it('hook 없으면 false 반환', () => {
    clearMockFiberRoot();
    const result = MCP.pressByLabel('anything');
    expect(result).toBe(false);
  });

  it('빈 문자열 시 false', () => {
    expect(MCP.pressByLabel('')).toBe(false);
  });

  it('중첩 onPress 노드에서 부모만 실행 (dedup)', () => {
    let parentPressed = false;
    let childPressed = false;
    const root = makeFiber('View', {}, [
      makeFiber(
        'TouchableOpacity',
        {
          onPress: () => {
            parentPressed = true;
          },
        },
        [
          makeFiber(
            'Pressable',
            {
              onPress: () => {
                childPressed = true;
              },
            },
            [makeFiber(MockText, { children: 'Click' })]
          ),
        ]
      ),
    ]);
    setMockFiberRoot(root);

    MCP.pressByLabel('Click');
    expect(parentPressed).toBe(true);
    expect(childPressed).toBe(false);
  });

  it('index 지정 시 n번째 매칭만 onPress 호출', () => {
    const pressed: number[] = [];
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => pressed.push(0) }, [
        makeFiber(MockText, { children: '탭:' }),
      ]),
      makeFiber('Pressable', { onPress: () => pressed.push(1) }, [
        makeFiber(MockText, { children: '탭:' }),
      ]),
      makeFiber('Pressable', { onPress: () => pressed.push(2) }, [
        makeFiber(MockText, { children: '탭:' }),
      ]),
    ]);
    setMockFiberRoot(root);

    expect(MCP.pressByLabel('탭:', 1)).toBe(true);
    expect(pressed).toEqual([1]);

    pressed.length = 0;
    expect(MCP.pressByLabel('탭:', 0)).toBe(true);
    expect(pressed).toEqual([0]);

    pressed.length = 0;
    expect(MCP.pressByLabel('탭:', 2)).toBe(true);
    expect(pressed).toEqual([2]);
  });

  it('index가 범위 밖이면 false', () => {
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockText, { children: '탭:' }),
    ]);
    setMockFiberRoot(root);
    expect(MCP.pressByLabel('탭:', 1)).toBe(false);
    expect(MCP.pressByLabel('탭:', 99)).toBe(false);
  });
});

describe('WebView 함수', () => {
  it('registerWebView + getRegisteredWebViewIds', () => {
    const mockRef = { injectJavaScript: mock(() => {}) };
    MCP.registerWebView(mockRef, 'test-wv');
    const ids = MCP.getRegisteredWebViewIds() as string[];
    expect(ids).toContain('test-wv');
  });

  it('unregisterWebView 후 목록에서 제거', () => {
    const mockRef = { injectJavaScript: mock(() => {}) };
    MCP.registerWebView(mockRef, 'wv-to-remove');
    MCP.unregisterWebView('wv-to-remove');
    const ids = MCP.getRegisteredWebViewIds() as string[];
    expect(ids).not.toContain('wv-to-remove');
  });

  it('clickInWebView — 등록된 WebView에 script 주입', () => {
    const injectFn = mock(() => {});
    MCP.registerWebView({ injectJavaScript: injectFn }, 'click-wv');
    const result = MCP.clickInWebView('click-wv', 'button.submit') as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(injectFn).toHaveBeenCalled();
  });

  it('clickInWebView — 미등록 WebView는 에러', () => {
    const result = MCP.clickInWebView('nonexistent', 'a') as { ok: boolean; error: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('evaluateInWebView — 임의 JS 실행', () => {
    const injectFn = mock(() => {});
    MCP.registerWebView({ injectJavaScript: injectFn }, 'eval-wv');
    const result = MCP.evaluateInWebView('eval-wv', 'document.title') as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(injectFn).toHaveBeenCalledWith('document.title');
  });

  it('evaluateInWebView — 미등록 WebView는 에러', () => {
    const result = MCP.evaluateInWebView('nonexistent', 'alert(1)') as {
      ok: boolean;
      error: string;
    };
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Scroll 함수', () => {
  it('registerScrollRef + getRegisteredScrollTestIDs', () => {
    const mockRef = { scrollTo: mock(() => {}) };
    MCP.registerScrollRef('test-scroll', mockRef);
    const ids = MCP.getRegisteredScrollTestIDs() as string[];
    expect(ids).toContain('test-scroll');
  });

  it('unregisterScrollRef 후 목록에서 제거', () => {
    const mockRef = { scrollTo: mock(() => {}) };
    MCP.registerScrollRef('scroll-to-remove', mockRef);
    MCP.unregisterScrollRef('scroll-to-remove');
    const ids = MCP.getRegisteredScrollTestIDs() as string[];
    expect(ids).not.toContain('scroll-to-remove');
  });

  it('scrollTo — ScrollView ref.scrollTo 호출', () => {
    const scrollToFn = mock(() => {});
    MCP.registerScrollRef('sv', { scrollTo: scrollToFn });
    const result = MCP.scrollTo('sv', { x: 0, y: 100, animated: true }) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(scrollToFn).toHaveBeenCalledWith({ x: 0, y: 100, animated: true });
  });

  it('scrollTo — FlatList ref.scrollToOffset fallback', () => {
    const scrollToOffsetFn = mock(() => {});
    MCP.registerScrollRef('fl', { scrollToOffset: scrollToOffsetFn });
    const result = MCP.scrollTo('fl', { y: 200 }) as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(scrollToOffsetFn).toHaveBeenCalledWith({ offset: 200, animated: true });
  });

  it('scrollTo — 미등록 ref는 에러', () => {
    const result = MCP.scrollTo('nonexistent', {}) as { ok: boolean; error: string };
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('getClickables — clickable 목록', () => {
  beforeEach(() => clearMockFiberRoot());

  it('pressHandler 등록된 testID 목록 반환', () => {
    MCP.registerPressHandler('btn-1', () => {});
    MCP.registerPressHandler('btn-2', () => {});
    const clickables = MCP.getClickables() as Array<{ uid: string; label: string }>;
    const uids = clickables.map((c) => c.uid);
    expect(uids).toContain('btn-1');
    expect(uids).toContain('btn-2');
  });

  it('Fiber root 있으면 label 포함', () => {
    MCP.registerPressHandler('fiber-btn', () => {});
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'fiber-btn', onPress: () => {} }, [
        makeFiber(MockText, { children: 'Fiber Label' }),
      ]),
    ]);
    setMockFiberRoot(root);
    const clickables = MCP.getClickables() as Array<{ uid: string; label: string }>;
    const item = clickables.find((c) => c.uid === 'fiber-btn');
    expect(item).toBeDefined();
    expect(item!.label).toBe('Fiber Label');
  });
});

describe('registerPressHandler + triggerPress', () => {
  it('등록 후 트리거 가능', () => {
    let called = false;
    MCP.registerPressHandler('test-btn', () => {
      called = true;
    });
    const result = MCP.triggerPress('test-btn');
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it('미등록 testID는 false', () => {
    expect(MCP.triggerPress('nonexistent')).toBe(false);
  });

  it('getRegisteredPressTestIDs에 포함', () => {
    MCP.registerPressHandler('my-id', () => {});
    const ids = MCP.getRegisteredPressTestIDs() as string[];
    expect(ids).toContain('my-id');
  });
});
