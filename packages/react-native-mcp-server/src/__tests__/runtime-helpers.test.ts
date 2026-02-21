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

// runtime.js의 XHR 패치가 동작하도록 mock XMLHttpRequest 등록
// happy-dom unregister 후 항상 재등록 (다른 테스트에서 캐시된 runtime.js의 패치 대상이 사라지므로)
class MockXMLHttpRequest {
  status = 0;
  statusText = '';
  responseText = '';
  _listeners: Record<string, Array<() => void>> = {};
  open(_method: string, _url: string) {}
  send(_body?: unknown) {}
  setRequestHeader(_name: string, _value: string) {}
  addEventListener(event: string, cb: () => void) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(cb);
  }
  getAllResponseHeaders() {
    return '';
  }
  _fireEvent(event: string) {
    (this._listeners[event] || []).forEach((cb) => cb());
  }
}
(globalThis as Record<string, unknown>).XMLHttpRequest = MockXMLHttpRequest;

// MCP 객체 참조 — 테스트에서 호출하는 메서드를 모두 포함한 타입으로 정의해 타입 오류 방지
const REQUIRED_MCP_METHODS = [
  'registerComponent',
  'registerPressHandler',
  'triggerPress',
  'getRegisteredPressTestIDs',
  'getClickables',
  'getTextNodes',
  'getComponentTree',
  'pressByLabel',
  'registerWebView',
  'unregisterWebView',
  'getWebViewIdForRef',
  'clickInWebView',
  'evaluateInWebView',
  'handleWebViewMessage',
  'createWebViewOnMessage',
  'getRegisteredWebViewIds',
  'registerScrollRef',
  'unregisterScrollRef',
  'scrollTo',
  'getRegisteredScrollTestIDs',
  'getConsoleLogs',
  'clearConsoleLogs',
  'getNetworkRequests',
  'clearNetworkRequests',
  'inspectState',
  'getStateChanges',
  'clearStateChanges',
  'enable',
  'triggerLongPress',
  'longPressByLabel',
  'typeText',
  'addNetworkMock',
  'removeNetworkMock',
  'listNetworkMocks',
  'clearNetworkMocks',
] as const;

type MCPApi = {
  [K in (typeof REQUIRED_MCP_METHODS)[number]]: (...args: unknown[]) => unknown;
};

let MCP!: MCPApi;

beforeAll(async () => {
  // 모듈 캐시 초기화 후 runtime.js 재로드 → XHR IIFE가 MockXMLHttpRequest에 패치 적용
  const runtimePath = require.resolve('../../runtime.js');
  delete require.cache[runtimePath];
  await import('../../runtime.js');
  MCP = (globalThis as Record<string, unknown>).__REACT_NATIVE_MCP__ as MCPApi;
});

// ─── Mock Fiber 트리 헬퍼 ────────────────────────────────────────

interface MockFiber {
  type: unknown;
  memoizedProps: Record<string, unknown>;
  child: MockFiber | null;
  sibling: MockFiber | null;
  return: MockFiber | null;
  stateNode?: Record<string, unknown>;
}

function makeFiber(
  type: unknown,
  props: Record<string, unknown>,
  children: MockFiber[] = []
): MockFiber {
  const fiber: MockFiber = { type, memoizedProps: props, child: null, sibling: null, return: null };
  for (let i = 0; i < children.length; i++) {
    const curr = children[i]!;
    curr.return = fiber;
    if (i === 0) fiber.child = curr;
    else children[i - 1]!.sibling = curr;
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
    for (const fn of REQUIRED_MCP_METHODS) {
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
    expect(result[0]!.text).toBe('Hello');
    expect(result[1]!.text).toBe('World');
  });

  it('조상 testID 있으면 testID 포함', () => {
    const root = makeFiber('View', { testID: 'screen' }, [
      makeFiber(MockText, { children: 'Title' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.getTextNodes() as Array<{ text: string; testID?: string }>;
    expect(result.length).toBe(1);
    expect(result[0]!.text).toBe('Title');
    expect(result[0]!.testID).toBe('screen');
  });
});

describe('getComponentTree — 컴포넌트 트리 스냅샷', () => {
  beforeEach(() => clearMockFiberRoot());

  it('hook 없으면 null', () => {
    clearMockFiberRoot();
    expect(MCP.getComponentTree({})).toBeNull();
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
    expect(tree.children!).toHaveLength(1);
    expect(tree.children![0]!.type).toBe('ScrollView');
    expect(tree.children![0]!.children).toHaveLength(1);
    const textNode = tree.children![0]!.children![0]! as { type?: string; text?: string };
    expect(textNode.type).toBe('Text');
    expect(textNode.text).toBe('Hello');
  });

  it('testID 없으면 uid가 경로', () => {
    const root = makeFiber('View', {}, [makeFiber(MockText, { children: 'A' })]);
    setMockFiberRoot(root);
    const tree = MCP.getComponentTree({}) as { uid: string; children?: Array<{ uid: string }> };
    expect(tree.uid).toBe('0');
    expect(tree.children!).toHaveLength(1);
    expect(tree.children![0]!.uid).toBe('0.0');
  });

  it('maxDepth 초과 시 하위 생략', () => {
    const root = makeFiber('View', {}, [
      makeFiber('View', {}, [makeFiber('View', {}, [makeFiber(MockText, { children: 'Deep' })])]),
    ]);
    setMockFiberRoot(root);
    const tree = MCP.getComponentTree({ maxDepth: 2 }) as { children?: unknown[] };
    expect(tree.children!).toHaveLength(1);
    const level1 = tree.children![0] as { children?: unknown[] };
    expect(level1.children!).toHaveLength(1);
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

  describe('getWebViewIdForRef — ref→id 역조회', () => {
    it('registerWebView 된 ref에 대해 해당 id 반환', () => {
      const mockRef = { injectJavaScript: mock(() => {}) };
      MCP.registerWebView(mockRef, 'wv-ref-lookup');
      const id = MCP.getWebViewIdForRef(mockRef) as string | null;
      expect(id).toBe('wv-ref-lookup');
    });

    it('unregisterWebView 후 같은 ref는 null 반환', () => {
      const mockRef = { injectJavaScript: mock(() => {}) };
      MCP.registerWebView(mockRef, 'wv-temp');
      expect(MCP.getWebViewIdForRef(mockRef)).toBe('wv-temp');
      MCP.unregisterWebView('wv-temp');
      expect(MCP.getWebViewIdForRef(mockRef)).toBeNull();
    });

    it('한 번도 등록하지 않은 ref는 null 반환', () => {
      const unknownRef = { injectJavaScript: () => {} };
      expect(MCP.getWebViewIdForRef(unknownRef)).toBeNull();
    });

    it('null/undefined ref는 null 반환', () => {
      expect(MCP.getWebViewIdForRef(null)).toBeNull();
      expect(MCP.getWebViewIdForRef(undefined)).toBeNull();
    });
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

  it('handleWebViewMessage — __mcpEvalResult면 true, 아니면 false', () => {
    const handled = MCP.handleWebViewMessage(
      JSON.stringify({ __mcpEvalResult: true, requestId: 'no-pending', value: 'x' })
    ) as boolean;
    expect(handled).toBe(false); // pending 없으면 소비 안 함
    const notOurs = MCP.handleWebViewMessage(JSON.stringify({ type: 'user-msg' })) as boolean;
    expect(notOurs).toBe(false);
  });

  it('createWebViewOnMessage — 일반 메시지는 userHandler에 전달', () => {
    const userHandler = mock(() => {});
    const wrapped = MCP.createWebViewOnMessage(userHandler) as (e: {
      nativeEvent: { data: string };
    }) => void;
    wrapped({ nativeEvent: { data: JSON.stringify({ type: 'user-tap' }) } });
    expect(userHandler).toHaveBeenCalledTimes(1);
    expect(userHandler).toHaveBeenCalledWith({
      nativeEvent: { data: JSON.stringify({ type: 'user-tap' }) },
    });
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

// ─── triggerLongPress ─────────────────────────────────────────

describe('triggerLongPress', () => {
  beforeEach(() => clearMockFiberRoot());

  it('Fiber에서 onLongPress 트리거 성공', () => {
    let called = false;
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', {
        testID: 'lp-btn',
        onLongPress: () => {
          called = true;
        },
      }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.triggerLongPress('lp-btn');
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it('testID 없으면 false 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', {
        onLongPress: () => {},
      }),
    ]);
    setMockFiberRoot(root);
    expect(MCP.triggerLongPress('nonexistent')).toBe(false);
  });

  it('onLongPress 없으면 false 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'no-lp', onPress: () => {} }),
    ]);
    setMockFiberRoot(root);
    expect(MCP.triggerLongPress('no-lp')).toBe(false);
  });

  it('Fiber root 없으면 false', () => {
    expect(MCP.triggerLongPress('any')).toBe(false);
  });
});

// ─── longPressByLabel ─────────────────────────────────────────

describe('longPressByLabel', () => {
  beforeEach(() => clearMockFiberRoot());

  it('label substring 매칭으로 long press 트리거', () => {
    let called = false;
    const root = makeFiber('View', {}, [
      makeFiber(
        'Pressable',
        {
          onLongPress: () => {
            called = true;
          },
        },
        [makeFiber(MockText, { children: '길게 누르기' })]
      ),
    ]);
    setMockFiberRoot(root);
    const result = MCP.longPressByLabel('길게');
    expect(result).toBe(true);
    expect(called).toBe(true);
  });

  it('index로 n번째 매칭 선택', () => {
    const calls: number[] = [];
    const root = makeFiber('View', {}, [
      makeFiber(
        'Pressable',
        {
          onLongPress: () => {
            calls.push(0);
          },
        },
        [makeFiber(MockText, { children: '버튼' })]
      ),
      makeFiber(
        'Pressable',
        {
          onLongPress: () => {
            calls.push(1);
          },
        },
        [makeFiber(MockText, { children: '버튼' })]
      ),
    ]);
    setMockFiberRoot(root);
    MCP.longPressByLabel('버튼', 1);
    expect(calls).toEqual([1]);
  });

  it('매칭 없으면 false', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: '클릭만' })]),
    ]);
    setMockFiberRoot(root);
    expect(MCP.longPressByLabel('클릭만')).toBe(false);
  });
});

// ─── typeText ─────────────────────────────────────────────────

describe('typeText', () => {
  beforeEach(() => clearMockFiberRoot());

  it('onChangeText 호출 성공', () => {
    let received = '';
    const root = makeFiber('View', {}, [
      makeFiber('TextInput', {
        testID: 'input-1',
        onChangeText: (t: string) => {
          received = t;
        },
      }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.typeText('input-1', 'hello') as { ok: boolean };
    expect(result.ok).toBe(true);
    expect(received).toBe('hello');
  });

  it('setNativeProps 호출 (stateNode 있을 때)', () => {
    let nativeText = '';
    const input = makeFiber('TextInput', {
      testID: 'input-2',
      onChangeText: () => {},
    });
    input.stateNode = {
      setNativeProps: (props: { text: string }) => {
        nativeText = props.text;
      },
    };
    const root = makeFiber('View', {}, [input]);
    setMockFiberRoot(root);
    MCP.typeText('input-2', 'world');
    expect(nativeText).toBe('world');
  });

  it('TextInput 없으면 에러 반환', () => {
    const root = makeFiber('View', {}, []);
    setMockFiberRoot(root);
    const result = MCP.typeText('missing', 'text') as { ok: boolean; error: string };
    expect(result.ok).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('Fiber root 없으면 에러', () => {
    const result = MCP.typeText('any', 'text') as { ok: boolean; error: string };
    expect(result.ok).toBe(false);
  });
});

// ─── Console Logs ─────────────────────────────────────────────

describe('getConsoleLogs / clearConsoleLogs', () => {
  beforeEach(() => {
    MCP.clearConsoleLogs();
  });

  it('초기 상태에서 빈 배열 반환', () => {
    const logs = MCP.getConsoleLogs() as unknown[];
    expect(logs).toEqual([]);
  });

  it('nativeLoggingHook 호출 시 버퍼에 로그 추가', () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook as (
      msg: string,
      level: number
    ) => void;
    expect(typeof hook).toBe('function');

    hook('hello world', 0);
    hook('warn message', 2);

    const logs = MCP.getConsoleLogs() as Array<{
      id: number;
      message: string;
      level: number;
      timestamp: number;
    }>;
    expect(logs).toHaveLength(2);
    expect(logs[0]!.message).toBe('hello world');
    expect(logs[0]!.level).toBe(0);
    expect(typeof logs[0]!.id).toBe('number');
    expect(typeof logs[0]!.timestamp).toBe('number');
    expect(logs[1]!.message).toBe('warn message');
    expect(logs[1]!.level).toBe(2);
  });

  it('level 문자열 필터링', () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook as (
      msg: string,
      level: number
    ) => void;

    hook('log msg', 0);
    hook('info msg', 1);
    hook('warn msg', 2);
    hook('error msg', 3);

    const warnOnly = MCP.getConsoleLogs({ level: 'warn' }) as Array<{
      message: string;
      level: number;
    }>;
    expect(warnOnly).toHaveLength(1);
    expect(warnOnly[0]!.message).toBe('warn msg');
    expect(warnOnly[0]!.level).toBe(2);

    const errorOnly = MCP.getConsoleLogs({ level: 'error' }) as Array<{
      message: string;
      level: number;
    }>;
    expect(errorOnly).toHaveLength(1);
    expect(errorOnly[0]!.message).toBe('error msg');
  });

  it('since 타임스탬프 필터', async () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook as (
      msg: string,
      level: number
    ) => void;

    hook('old msg', 0);
    const midpoint = Date.now();
    // 약간의 시간 차이를 위해 1ms 대기
    await new Promise((r) => setTimeout(r, 5));
    hook('new msg', 0);

    const filtered = MCP.getConsoleLogs({ since: midpoint }) as Array<{ message: string }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.message).toBe('new msg');
  });

  it('limit 옵션으로 최대 반환 수 제한', () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook as (
      msg: string,
      level: number
    ) => void;

    for (let i = 0; i < 10; i++) hook(`msg-${i}`, 0);

    const limited = MCP.getConsoleLogs({ limit: 3 }) as Array<{ message: string }>;
    expect(limited).toHaveLength(3);
    // 최근 3개 반환 (slice from end)
    expect(limited[0]!.message).toBe('msg-7');
    expect(limited[2]!.message).toBe('msg-9');
  });

  it('clearConsoleLogs 후 빈 배열', () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook as (
      msg: string,
      level: number
    ) => void;

    hook('will be cleared', 0);
    expect((MCP.getConsoleLogs() as unknown[]).length).toBeGreaterThan(0);

    MCP.clearConsoleLogs();
    expect(MCP.getConsoleLogs()).toEqual([]);
  });

  it('버퍼 크기 제한 (500개 초과 시 oldest 제거)', () => {
    const hook = (globalThis as Record<string, unknown>).nativeLoggingHook as (
      msg: string,
      level: number
    ) => void;

    for (let i = 0; i < 510; i++) hook(`msg-${i}`, 0);

    const all = MCP.getConsoleLogs({ limit: 600 }) as Array<{ message: string }>;
    expect(all).toHaveLength(500);
    // 첫 10개가 제거되었으므로 msg-10이 첫 번째
    expect(all[0]!.message).toBe('msg-10');
    expect(all[499]!.message).toBe('msg-509');
  });
});

// ─── Network Requests (XHR) ──────────────────────────────────────

/** XHR mock 인스턴스 타입 (setup-globals.ts에서 등록한 MockXMLHttpRequest) */
interface TestXHR {
  status: number;
  statusText: string;
  responseText: string;
  open(method: string, url: string): void;
  send(body?: unknown): void;
  setRequestHeader(name: string, value: string): void;
  addEventListener(event: string, cb: () => void): void;
  getAllResponseHeaders(): string;
  _fireEvent(event: string): void;
}

describe('getNetworkRequests / clearNetworkRequests (XHR)', () => {
  /** 패치된 XHR 인스턴스를 생성하고 테스트에 사용 */
  function createXHR(opts?: {
    status?: number;
    statusText?: string;
    responseText?: string;
  }): TestXHR {
    const XHRClass = (globalThis as Record<string, unknown>).XMLHttpRequest as new () => TestXHR;
    const xhr = new XHRClass();
    xhr.status = opts?.status ?? 200;
    xhr.statusText = opts?.statusText ?? 'OK';
    xhr.responseText = opts?.responseText ?? '{"ok":true}';
    return xhr;
  }

  beforeEach(() => {
    MCP.clearNetworkRequests();
  });

  it('초기 상태에서 빈 배열 반환', () => {
    const requests = MCP.getNetworkRequests() as unknown[];
    expect(requests).toEqual([]);
  });

  it('XHR open → send → load 시 버퍼에 추가', () => {
    const xhr = createXHR();
    xhr.open('GET', 'https://api.example.com/users');
    xhr.send(null);
    xhr._fireEvent('load');

    const requests = MCP.getNetworkRequests() as Array<{
      id: number;
      method: string;
      url: string;
      status: number;
      state: string;
      duration: number;
    }>;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.method).toBe('GET');
    expect(requests[0]!.url).toBe('https://api.example.com/users');
    expect(requests[0]!.status).toBe(200);
    expect(requests[0]!.state).toBe('done');
    expect(typeof requests[0]!.duration).toBe('number');
    expect(typeof requests[0]!.id).toBe('number');
  });

  it('XHR error 이벤트 시 error 마킹', () => {
    const xhr = createXHR();
    xhr.open('POST', 'https://api.example.com/fail');
    xhr.send('{"data":1}');
    xhr._fireEvent('error');

    const requests = MCP.getNetworkRequests() as Array<{
      error: string;
      state: string;
      method: string;
    }>;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.error).toBe('Network error');
    expect(requests[0]!.state).toBe('error');
    expect(requests[0]!.method).toBe('POST');
  });

  it('XHR timeout 이벤트 시 timeout 마킹', () => {
    const xhr = createXHR();
    xhr.open('GET', 'https://api.example.com/slow');
    xhr.send(null);
    xhr._fireEvent('timeout');

    const requests = MCP.getNetworkRequests() as Array<{ error: string; state: string }>;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.error).toBe('Timeout');
    expect(requests[0]!.state).toBe('error');
  });

  it('setRequestHeader로 요청 헤더 수집', () => {
    const xhr = createXHR();
    xhr.open('POST', 'https://api.example.com/data');
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('Authorization', 'Bearer token123');
    xhr.send('{"key":"value"}');
    xhr._fireEvent('load');

    const requests = MCP.getNetworkRequests() as Array<{
      requestHeaders: Record<string, string>;
      requestBody: string;
    }>;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.requestHeaders['Content-Type']).toBe('application/json');
    expect(requests[0]!.requestHeaders['Authorization']).toBe('Bearer token123');
    expect(requests[0]!.requestBody).toBe('{"key":"value"}');
  });

  it('url substring 필터', () => {
    const xhr1 = createXHR();
    xhr1.open('GET', 'https://api.example.com/users');
    xhr1.send(null);
    xhr1._fireEvent('load');

    const xhr2 = createXHR();
    xhr2.open('GET', 'https://api.example.com/posts');
    xhr2.send(null);
    xhr2._fireEvent('load');

    const filtered = MCP.getNetworkRequests({ url: 'users' }) as Array<{ url: string }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.url).toContain('users');
  });

  it('method 필터', () => {
    const xhr1 = createXHR();
    xhr1.open('GET', 'https://api.example.com/a');
    xhr1.send(null);
    xhr1._fireEvent('load');

    const xhr2 = createXHR();
    xhr2.open('POST', 'https://api.example.com/b');
    xhr2.send(null);
    xhr2._fireEvent('load');

    const filtered = MCP.getNetworkRequests({ method: 'POST' }) as Array<{ method: string }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.method).toBe('POST');
  });

  it('since 타임스탬프 필터', async () => {
    const xhr1 = createXHR();
    xhr1.open('GET', 'https://api.example.com/old');
    xhr1.send(null);
    xhr1._fireEvent('load');

    const midpoint = Date.now();
    await new Promise((r) => setTimeout(r, 5));

    const xhr2 = createXHR();
    xhr2.open('GET', 'https://api.example.com/new');
    xhr2.send(null);
    xhr2._fireEvent('load');

    const filtered = MCP.getNetworkRequests({ since: midpoint }) as Array<{ url: string }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.url).toContain('new');
  });

  it('clearNetworkRequests 후 빈 배열', () => {
    const xhr = createXHR();
    xhr.open('GET', 'https://api.example.com/test');
    xhr.send(null);
    xhr._fireEvent('load');

    expect((MCP.getNetworkRequests() as unknown[]).length).toBeGreaterThan(0);
    MCP.clearNetworkRequests();
    expect(MCP.getNetworkRequests()).toEqual([]);
  });

  it('버퍼 크기 제한 (200개 초과 시 oldest 제거)', () => {
    for (let i = 0; i < 210; i++) {
      const xhr = createXHR();
      xhr.open('GET', `https://api.example.com/item-${i}`);
      xhr.send(null);
      xhr._fireEvent('load');
    }

    const all = MCP.getNetworkRequests({ limit: 300 }) as Array<{ url: string }>;
    expect(all).toHaveLength(200);
    expect(all[0]!.url).toContain('item-10');
    expect(all[199]!.url).toContain('item-209');
  });

  it('requestBody 크기 제한 (10000자 초과 시 잘림)', () => {
    const longBody = 'x'.repeat(15000);
    const xhr = createXHR();
    xhr.open('POST', 'https://api.example.com/big');
    xhr.send(longBody);
    xhr._fireEvent('load');

    const requests = MCP.getNetworkRequests() as Array<{ requestBody: string }>;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.requestBody).toHaveLength(10000);
  });

  it('responseBody 크기 제한 (10000자 초과 시 잘림)', () => {
    const longResponse = 'y'.repeat(15000);
    const xhr = createXHR({ responseText: longResponse });
    xhr.open('GET', 'https://api.example.com/big-response');
    xhr.send(null);
    xhr._fireEvent('load');

    const requests = MCP.getNetworkRequests() as Array<{ responseBody: string }>;
    expect(requests).toHaveLength(1);
    expect(requests[0]!.responseBody).toHaveLength(10000);
  });

  it('status 필터', () => {
    const xhr1 = createXHR({ status: 200 });
    xhr1.open('GET', 'https://api.example.com/ok');
    xhr1.send(null);
    xhr1._fireEvent('load');

    const xhr2 = createXHR({ status: 404 });
    xhr2.open('GET', 'https://api.example.com/missing');
    xhr2.send(null);
    xhr2._fireEvent('load');

    const filtered = MCP.getNetworkRequests({ status: 404 }) as Array<{
      status: number;
      url: string;
    }>;
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.status).toBe(404);
    expect(filtered[0]!.url).toContain('missing');
  });

  it('limit 옵션으로 최대 반환 수 제한', () => {
    for (let i = 0; i < 10; i++) {
      const xhr = createXHR();
      xhr.open('GET', `https://api.example.com/item-${i}`);
      xhr.send(null);
      xhr._fireEvent('load');
    }

    const limited = MCP.getNetworkRequests({ limit: 3 }) as Array<{ url: string }>;
    expect(limited).toHaveLength(3);
    // 최근 3개 반환 (slice from end)
    expect(limited[0]!.url).toContain('item-7');
    expect(limited[2]!.url).toContain('item-9');
  });
});

// ─── Network Requests (fetch) ────────────────────────────────────

describe('getNetworkRequests / clearNetworkRequests (fetch)', () => {
  beforeEach(() => {
    MCP.clearNetworkRequests();
  });

  it('fetch GET 요청 캡처', async () => {
    // globalThis.fetch가 패치되어 있는지 확인
    const fetchFn = (globalThis as Record<string, unknown>).fetch as (
      url: string,
      init?: Record<string, unknown>
    ) => Promise<unknown>;
    if (typeof fetchFn !== 'function') return; // fetch 미지원 환경 스킵

    try {
      await fetchFn('https://api.example.com/fetch-test');
    } catch {
      // 실제 네트워크 에러는 무시 — 캡처 여부만 확인
    }

    // fetch 에러 시에도 entry가 추가되어야 함
    const requests = MCP.getNetworkRequests() as Array<{
      method: string;
      url: string;
      state: string;
    }>;
    expect(requests.length).toBeGreaterThanOrEqual(1);
    expect(requests[0]!.url).toBe('https://api.example.com/fetch-test');
    expect(requests[0]!.method).toBe('GET');
  });

  it('fetch POST 요청 캡처', async () => {
    const fetchFn = (globalThis as Record<string, unknown>).fetch as (
      url: string,
      init?: Record<string, unknown>
    ) => Promise<unknown>;
    if (typeof fetchFn !== 'function') return;

    try {
      await fetchFn('https://api.example.com/fetch-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{"hello":"world"}',
      });
    } catch {
      // 실제 네트워크 에러는 무시
    }

    const requests = MCP.getNetworkRequests() as Array<{
      method: string;
      url: string;
      requestBody: string | null;
    }>;
    expect(requests.length).toBeGreaterThanOrEqual(1);
    const post = requests.find((r) => r.method === 'POST');
    expect(post).toBeDefined();
    expect(post!.url).toBe('https://api.example.com/fetch-post');
    expect(post!.requestBody).toBe('{"hello":"world"}');
  });
});

// ─── 제스처 한계 및 RNGH/Reanimated 호환 (스와이프·팬·애니메이션) ─────

describe('제스처 한계 및 RNGH/Reanimated 호환', () => {
  beforeEach(() => clearMockFiberRoot());

  it('MCP에 triggerSwipe/triggerPan 없음 — 스와이프·팬은 JS로 트리거 불가', () => {
    expect((MCP as Record<string, unknown>).triggerSwipe).toBeUndefined();
    expect((MCP as Record<string, unknown>).triggerPan).toBeUndefined();
  });

  it('triggerPress는 컴포넌트 타입 무관 — onPress+testID만 있으면 동작 (RNGH TouchableOpacity 등)', () => {
    let called = false;
    const TouchableOpacityType = function TouchableOpacity() {};
    const root = makeFiber('View', {}, [
      makeFiber(TouchableOpacityType, { testID: 'gh-btn', onPress: () => (called = true) }, [
        makeFiber(MockText, { children: 'RNGH' }),
      ]),
    ]);
    setMockFiberRoot(root);
    expect(MCP.triggerPress('gh-btn')).toBe(true);
    expect(called).toBe(true);
  });

  it('getComponentTree는 type이 객체(Reanimated 래퍼)인 Fiber도 노드로 포함', () => {
    const AnimatedViewType = function AnimatedView() {};
    (AnimatedViewType as { displayName?: string }).displayName = 'Animated.View';
    const root = makeFiber('View', {}, [
      makeFiber(AnimatedViewType, { testID: 'reanimated-box' }, [
        makeFiber(MockText, { children: '텍스트' }),
      ]),
    ]);
    setMockFiberRoot(root);
    const tree = MCP.getComponentTree({ maxDepth: 10 }) as {
      uid: string;
      type: string;
      children?: Array<{ uid?: string; type?: string; children?: unknown[] }>;
    };
    expect(tree).toBeDefined();
    function find(n: {
      uid?: string;
      type?: string;
      children?: unknown[];
    }): { uid?: string; type?: string } | null {
      if (n.uid === 'reanimated-box') return n;
      for (const c of n.children || []) {
        const child = c as { uid?: string; type?: string; children?: unknown[] };
        const found = find(child);
        if (found) return found;
      }
      return null;
    }
    const node = find(tree);
    expect(node).toBeDefined();
    expect(node!.uid).toBe('reanimated-box');
    expect(node!.type).toBe('Animated.View');
  });

  it('pressByLabel은 라벨만 맞으면 컴포넌트 타입 무관 onPress 호출 (RNGH 내부 버튼 등)', () => {
    let called = false;
    const GesturePressable = function GesturePressable() {};
    const root = makeFiber('View', {}, [
      makeFiber(GesturePressable, { onPress: () => (called = true) }, [
        makeFiber(MockText, { children: '스와이프 아님 탭' }),
      ]),
    ]);
    setMockFiberRoot(root);
    expect(MCP.pressByLabel('탭')).toBe(true);
    expect(called).toBe(true);
  });
});

// ─── Network Mock ──────────────────────────────────────────────────

describe('addNetworkMock / listNetworkMocks / removeNetworkMock / clearNetworkMocks', () => {
  beforeEach(() => {
    MCP.clearNetworkMocks();
  });

  it('addNetworkMock — 룰 추가 후 id 포함 객체 반환', () => {
    const rule = MCP.addNetworkMock({ urlPattern: '/api/users', status: 200 }) as {
      id: number;
      urlPattern: string;
      enabled: boolean;
      hitCount: number;
    };
    expect(rule.id).toBeGreaterThan(0);
    expect(rule.urlPattern).toBe('/api/users');
    expect(rule.enabled).toBe(true);
    expect(rule.hitCount).toBe(0);
  });

  it('addNetworkMock — method 대소문자 정규화', () => {
    const rule = MCP.addNetworkMock({ urlPattern: '/api', method: 'post' }) as {
      method: string | null;
    };
    expect(rule.method).toBe('POST');
  });

  it('addNetworkMock — method 미지정 시 null (모든 메서드 매칭)', () => {
    const rule = MCP.addNetworkMock({ urlPattern: '/api' }) as { method: string | null };
    expect(rule.method).toBeNull();
  });

  it('addNetworkMock — 기본값 (status 200, body 빈 문자열, delay 0)', () => {
    const rule = MCP.addNetworkMock({ urlPattern: '/default' }) as {
      response: { status: number; body: string; delay: number };
    };
    expect(rule.response.status).toBe(200);
    expect(rule.response.body).toBe('');
    expect(rule.response.delay).toBe(0);
  });

  it('listNetworkMocks — 룰 목록 반환', () => {
    MCP.addNetworkMock({ urlPattern: '/a' });
    MCP.addNetworkMock({ urlPattern: '/b', method: 'POST' });
    const list = MCP.listNetworkMocks() as Array<{
      id: number;
      urlPattern: string;
      method: string | null;
    }>;
    expect(list).toHaveLength(2);
    expect(list[0]!.urlPattern).toBe('/a');
    expect(list[1]!.urlPattern).toBe('/b');
    expect(list[1]!.method).toBe('POST');
  });

  it('removeNetworkMock — ID로 제거 성공 시 true', () => {
    const rule = MCP.addNetworkMock({ urlPattern: '/remove-me' }) as { id: number };
    const removed = MCP.removeNetworkMock(rule.id) as boolean;
    expect(removed).toBe(true);
    const list = MCP.listNetworkMocks() as unknown[];
    expect(list).toHaveLength(0);
  });

  it('removeNetworkMock — 존재하지 않는 ID는 false', () => {
    const removed = MCP.removeNetworkMock(99999) as boolean;
    expect(removed).toBe(false);
  });

  it('clearNetworkMocks — 모든 룰 제거', () => {
    MCP.addNetworkMock({ urlPattern: '/a' });
    MCP.addNetworkMock({ urlPattern: '/b' });
    MCP.clearNetworkMocks();
    const list = MCP.listNetworkMocks() as unknown[];
    expect(list).toHaveLength(0);
  });

  it('isRegex: true — 정규식 패턴 매칭', () => {
    const rule = MCP.addNetworkMock({
      urlPattern: '^https://api\\.example\\.com/users/\\d+$',
      isRegex: true,
      status: 200,
    }) as { isRegex: boolean };
    expect(rule.isRegex).toBe(true);
  });
});

describe('Network Mock — XHR 인터셉트', () => {
  function createXHR(): TestXHR {
    const XHRClass = (globalThis as Record<string, unknown>).XMLHttpRequest as new () => TestXHR;
    return new XHRClass();
  }

  beforeEach(() => {
    MCP.clearNetworkMocks();
    MCP.clearNetworkRequests();
  });

  it('mock 룰 매칭 시 실제 요청 없이 mock 응답 반환 + mocked: true', async () => {
    MCP.addNetworkMock({
      urlPattern: '/api/mock-test',
      status: 201,
      body: '{"mocked":true}',
    });

    const xhr = createXHR();
    xhr.open('GET', 'https://example.com/api/mock-test');
    xhr.send(null);

    // mock은 setTimeout(fn, 0)으로 비동기 전달
    await new Promise((r) => setTimeout(r, 50));

    const requests = MCP.getNetworkRequests() as Array<{
      url: string;
      status: number;
      state: string;
      mocked?: boolean;
      responseBody?: string;
    }>;
    const mocked = requests.find((r) => r.url.includes('/api/mock-test'));
    expect(mocked).toBeDefined();
    expect(mocked!.status).toBe(201);
    expect(mocked!.state).toBe('done');
    expect(mocked!.mocked).toBe(true);
    expect(mocked!.responseBody).toBe('{"mocked":true}');
  });

  it('mock 룰 매칭 시 hitCount 증가', async () => {
    MCP.addNetworkMock({ urlPattern: '/hit-count' });

    const xhr = createXHR();
    xhr.open('GET', 'https://example.com/hit-count');
    xhr.send(null);
    await new Promise((r) => setTimeout(r, 50));

    const list = MCP.listNetworkMocks() as Array<{ hitCount: number }>;
    expect(list[0]!.hitCount).toBe(1);
  });

  it('method 필터 — GET만 매칭, POST는 통과', async () => {
    MCP.addNetworkMock({ urlPattern: '/method-filter', method: 'GET', status: 200 });

    // GET → 매칭
    const xhr1 = createXHR();
    xhr1.open('GET', 'https://example.com/method-filter');
    xhr1.send(null);
    await new Promise((r) => setTimeout(r, 50));

    // POST → 매칭 안 됨 (실제 XHR send 호출됨)
    const xhr2 = createXHR();
    xhr2.open('POST', 'https://example.com/method-filter');
    xhr2.send(null);
    // POST는 mock이 아니므로 load 이벤트를 직접 트리거
    xhr2._fireEvent('load');

    const requests = MCP.getNetworkRequests() as Array<{
      method: string;
      mocked?: boolean;
    }>;
    const getMocked = requests.find((r) => r.method === 'GET');
    const postReal = requests.find((r) => r.method === 'POST');
    expect(getMocked!.mocked).toBe(true);
    expect(postReal!.mocked).toBeUndefined();
  });

  it('regex 패턴 매칭', async () => {
    MCP.addNetworkMock({
      urlPattern: '/users/\\d+',
      isRegex: true,
      status: 200,
      body: '{"user":"mock"}',
    });

    const xhr = createXHR();
    xhr.open('GET', 'https://api.example.com/users/42');
    xhr.send(null);
    await new Promise((r) => setTimeout(r, 50));

    const requests = MCP.getNetworkRequests() as Array<{ mocked?: boolean }>;
    expect(requests[0]!.mocked).toBe(true);
  });

  it('매칭 없으면 실제 XHR 호출됨', () => {
    MCP.addNetworkMock({ urlPattern: '/only-this-url' });

    const xhr = createXHR();
    xhr.open('GET', 'https://example.com/different-url');
    xhr.send(null);
    xhr._fireEvent('load');

    const requests = MCP.getNetworkRequests() as Array<{ mocked?: boolean }>;
    expect(requests[0]!.mocked).toBeUndefined();
  });
});

describe('Network Mock — fetch 인터셉트', () => {
  beforeEach(() => {
    MCP.clearNetworkMocks();
    MCP.clearNetworkRequests();
  });

  it('mock 룰 매칭 시 fake Response 반환 + mocked: true', async () => {
    MCP.addNetworkMock({
      urlPattern: '/api/fetch-mock',
      status: 200,
      body: '{"fetched":"mock"}',
      headers: { 'Content-Type': 'application/json' },
    });

    const fetchFn = (globalThis as Record<string, unknown>).fetch as (
      url: string,
      init?: Record<string, unknown>
    ) => Promise<{ status: number; text(): Promise<string> }>;
    if (typeof fetchFn !== 'function') return;

    const response = await fetchFn('https://example.com/api/fetch-mock');
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toBe('{"fetched":"mock"}');

    // entry가 버퍼에 추가될 때까지 대기
    await new Promise((r) => setTimeout(r, 50));

    const requests = MCP.getNetworkRequests() as Array<{
      url: string;
      mocked?: boolean;
      status: number;
    }>;
    const mocked = requests.find((r) => r.url.includes('/api/fetch-mock'));
    expect(mocked).toBeDefined();
    expect(mocked!.mocked).toBe(true);
    expect(mocked!.status).toBe(200);
  });

  it('mock 미매칭 시 실제 fetch 호출', async () => {
    MCP.addNetworkMock({ urlPattern: '/only-mock-url' });

    const fetchFn = (globalThis as Record<string, unknown>).fetch as (
      url: string
    ) => Promise<unknown>;
    if (typeof fetchFn !== 'function') return;

    try {
      await fetchFn('https://example.com/real-url');
    } catch {
      // 실제 네트워크 에러는 무시
    }

    await new Promise((r) => setTimeout(r, 50));

    const requests = MCP.getNetworkRequests() as Array<{
      url: string;
      mocked?: boolean;
    }>;
    const entry = requests.find((r) => r.url.includes('/real-url'));
    expect(entry).toBeDefined();
    expect(entry!.mocked).toBeUndefined();
  });

  it('delay > 0 시 지연 후 응답', async () => {
    MCP.addNetworkMock({
      urlPattern: '/delayed',
      status: 200,
      body: 'delayed-response',
      delay: 100,
    });

    const fetchFn = (globalThis as Record<string, unknown>).fetch as (
      url: string
    ) => Promise<{ text(): Promise<string> }>;
    if (typeof fetchFn !== 'function') return;

    const start = Date.now();
    const response = await fetchFn('https://example.com/delayed');
    const elapsed = Date.now() - start;

    const body = await response.text();
    expect(body).toBe('delayed-response');
    expect(elapsed).toBeGreaterThanOrEqual(80); // 약간의 타이머 오차 허용
  });
});
