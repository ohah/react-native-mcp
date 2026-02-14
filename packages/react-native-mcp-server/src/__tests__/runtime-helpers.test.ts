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
    expect(typeof MCP.getByLabel).toBe('function');
    expect(typeof MCP.pressByLabel).toBe('function');
    expect(typeof MCP.getClickables).toBe('function');
    expect(typeof MCP.getClickableTextContent).toBe('function');
    expect(typeof MCP.getTextNodes).toBe('function');
    expect(typeof MCP.getComponentTree).toBe('function');
  });
});

describe('getByLabel — fiber 트리 탐색', () => {
  beforeEach(() => clearMockFiberRoot());

  it('hook 없으면 hookPresent: false', () => {
    clearMockFiberRoot();
    const result = MCP.getByLabel('') as Record<string, unknown>;
    expect(result.hookPresent).toBe(false);
    expect(result.labelsWithOnPress).toEqual([]);
  });

  it('root 없으면 rootPresent: false', () => {
    (globalThis as Record<string, unknown>).__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      renderers: new Map([[1, {}]]),
      getFiberRoots: () => new Set(), // 빈 set
    };
    const result = MCP.getByLabel('') as Record<string, unknown>;
    expect(result.hookPresent).toBe(true);
    expect(result.rendererPresent).toBe(true);
    expect(result.rootPresent).toBe(false);
  });

  it('onPress 가진 노드의 텍스트 라벨 수집', () => {
    // View > [Pressable(onPress) > Text("Hello"), Pressable(onPress) > Text("World")]
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: 'Hello' })]),
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: 'World' })]),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('') as Record<string, unknown>;
    expect(result.rootPresent).toBe(true);
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    expect(labels.length).toBe(2);
    expect(labels[0].text).toBe('Hello');
    expect(labels[1].text).toBe('World');
  });

  it('labelSubstring 매칭 시 match 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: '로그인' })]),
      makeFiber('Pressable', { onPress: () => {} }, [
        makeFiber(MockText, { children: '회원가입' }),
      ]),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('회원') as Record<string, unknown>;
    const match = result.match as { text: string };
    expect(match).toBeDefined();
    expect(match.text).toBe('회원가입');
  });

  it('중첩된 Text children 을 concat', () => {
    // Pressable > [Text("Good"), Text("Morning")] → "GoodMorning" (trim후 concat)
    // getLabel에서 replace(/\s+/g, ' ').trim() 적용되므로 trim된 결과 concat
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockText, { children: 'Good' }),
      makeFiber(MockText, { children: 'Morning' }),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    expect(labels[0].text).toBe('GoodMorning');
  });

  it('배열 children Text 처리', () => {
    // Text with children: ["Hello ", "World"]
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockText, { children: ['Hello ', 'World'] }),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    expect(labels[0].text).toBe('Hello World');
  });

  it('Text children에 number가 있으면 문자열로 합쳐짐 (textContent)', () => {
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockText, { children: ['탭: ', 1] }),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    expect(labels[0].text).toBe('탭: 1');
  });

  it('onPress 노드의 children은 중복 수집하지 않음 (dedup)', () => {
    // TouchableOpacity(onPress) > Pressable(onPress, 내부 자동 생성) > Text
    const root = makeFiber('View', {}, [
      makeFiber('TouchableOpacity', { onPress: () => {} }, [
        makeFiber('Pressable', { onPress: () => {} }, [
          makeFiber(MockText, { children: 'Button' }),
        ]),
      ]),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    // TouchableOpacity만 수집 (자식 Pressable은 skip)
    expect(labels.length).toBe(1);
    expect(labels[0].text).toBe('Button');
  });

  it('accessibilityLabel fallback', () => {
    const root = makeFiber(
      'Pressable',
      {
        onPress: () => {},
        accessibilityLabel: 'Close dialog',
      },
      []
    );
    setMockFiberRoot(root);

    const result = MCP.getByLabel('Close') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    expect(labels[0].text).toBe('Close dialog');
    expect((result.match as { text: string }).text).toBe('Close dialog');
  });

  it('Image의 accessibilityLabel 수집', () => {
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockImage, { accessibilityLabel: 'Profile picture' }),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('Profile') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string }>;
    expect(labels[0].text).toBe('Profile picture');
  });

  it('testID 포함된 노드', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {}, testID: 'btn-login' }, [
        makeFiber(MockText, { children: 'Login' }),
      ]),
    ]);
    setMockFiberRoot(root);

    const result = MCP.getByLabel('') as Record<string, unknown>;
    const labels = result.labelsWithOnPress as Array<{ text: string; testID?: string }>;
    expect(labels[0].testID).toBe('btn-login');
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

describe('getClickableTextContent — onPress 노드별 textContent', () => {
  beforeEach(() => clearMockFiberRoot());

  it('hook 없으면 빈 배열', () => {
    clearMockFiberRoot();
    const result = MCP.getClickableTextContent() as Array<{ text: string; testID?: string }>;
    expect(result).toEqual([]);
  });

  it('getByLabel labelsWithOnPress와 동일 배열 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {}, testID: 'btn-a' }, [
        makeFiber(MockText, { children: '버튼 A' }),
      ]),
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: '버튼 B' })]),
    ]);
    setMockFiberRoot(root);

    const content = MCP.getClickableTextContent() as Array<{ text: string; testID?: string }>;
    const byLabel = MCP.getByLabel('') as Record<string, unknown>;
    const labels = byLabel.labelsWithOnPress as Array<{ text: string; testID?: string }>;
    expect(content).toEqual(labels);
    expect(content).toHaveLength(2);
    expect(content[0].text).toBe('버튼 A');
    expect(content[0].testID).toBe('btn-a');
    expect(content[1].text).toBe('버튼 B');
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
