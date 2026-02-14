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
