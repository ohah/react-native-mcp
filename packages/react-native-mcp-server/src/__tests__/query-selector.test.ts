/**
 * querySelector / querySelectorAll 단위 테스트
 * Fiber 트리 셀렉터 파서 및 매칭 엔진 검증.
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

// runtime.js가 설정한 원본 hook 보존
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

// ─── 테스트 ─────────────────────────────────────────────────────

describe('querySelector — 타입 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('타입으로 첫 번째 요소 검색', () => {
    const root = makeFiber('View', {}, [
      makeFiber('ScrollView', { testID: 'sv-1' }),
      makeFiber('ScrollView', { testID: 'sv-2' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('ScrollView') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.type).toBe('ScrollView');
    expect(result.testID).toBe('sv-1');
  });

  it('존재하지 않는 타입은 null 반환', () => {
    const root = makeFiber('View', {}, []);
    setMockFiberRoot(root);
    expect(MCP.querySelector('FlatList')).toBeNull();
  });
});

describe('querySelector — #testID 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('testID로 요소 검색', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'btn-login', onPress: () => {} }),
      makeFiber('Pressable', { testID: 'btn-register', onPress: () => {} }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('#btn-login') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.testID).toBe('btn-login');
  });

  it('타입 + testID 결합: ScrollView#main', () => {
    const root = makeFiber('View', {}, [
      makeFiber('ScrollView', { testID: 'main' }),
      makeFiber('FlatList', { testID: 'main' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('ScrollView#main') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.type).toBe('ScrollView');
    expect(result.testID).toBe('main');
  });
});

describe('querySelector — :text() 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('텍스트 포함 검색 (substring)', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: '로그인' })]),
      makeFiber('Pressable', { onPress: () => {} }, [
        makeFiber(MockText, { children: '회원가입' }),
      ]),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('Pressable:text("회원")') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.text).toBe('회원가입');
  });

  it('작은따옴표도 지원', () => {
    const root = makeFiber('Pressable', { onPress: () => {} }, [
      makeFiber(MockText, { children: 'Hello' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector("Pressable:text('Hello')") as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.text).toBe('Hello');
  });
});

describe('querySelector — [attr="val"] 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('accessibilityLabel로 검색', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { accessibilityLabel: 'Close', onPress: () => {} }),
      makeFiber('Pressable', { accessibilityLabel: 'Open', onPress: () => {} }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('[accessibilityLabel="Close"]') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.accessibilityLabel).toBe('Close');
  });
});

describe('querySelector — :has-press / :has-scroll', () => {
  beforeEach(() => clearMockFiberRoot());

  it(':has-press는 onPress가 있는 요소만 매칭', () => {
    const root = makeFiber('View', {}, [
      makeFiber('View', {}),
      makeFiber('Pressable', { onPress: () => {}, testID: 'clickable' }),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector(':has-press') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.hasOnPress).toBe(true);
    expect(result.testID).toBe('clickable');
  });

  it(':has-scroll은 scrollTo가 있는 stateNode 매칭', () => {
    const sv = makeFiber('ScrollView', { testID: 'sv' });
    sv.stateNode = { scrollTo: () => {} };
    const root = makeFiber('View', {}, [sv]);
    setMockFiberRoot(root);
    const result = MCP.querySelector(':has-scroll') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.hasScrollTo).toBe(true);
  });
});

describe('querySelectorAll — 다중 결과', () => {
  beforeEach(() => clearMockFiberRoot());

  it('타입으로 모든 매칭 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'a', onPress: () => {} }),
      makeFiber('Pressable', { testID: 'b', onPress: () => {} }),
      makeFiber(MockText, { children: 'hi' }),
    ]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('Pressable') as Array<Record<string, unknown>>;
    expect(results.length).toBe(2);
  });

  it(':nth(N)은 N번째 매칭만 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'btn-0' }),
      makeFiber('Pressable', { testID: 'btn-1' }),
      makeFiber('Pressable', { testID: 'btn-2' }),
    ]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('Pressable:nth(1)') as Array<Record<string, unknown>>;
    expect(results.length).toBe(1);
    expect(results[0].testID).toBe('btn-1');
  });

  it(':nth 범위 초과 시 빈 배열', () => {
    const root = makeFiber('View', {}, [makeFiber('Pressable', {})]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('Pressable:nth(5)') as Array<Record<string, unknown>>;
    expect(results).toEqual([]);
  });

  it(':first는 첫 번째 매칭만 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'btn-0' }),
      makeFiber('Pressable', { testID: 'btn-1' }),
      makeFiber('Pressable', { testID: 'btn-2' }),
    ]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('Pressable:first') as Array<Record<string, unknown>>;
    expect(results.length).toBe(1);
    expect(results[0].testID).toBe('btn-0');
  });

  it(':last는 마지막 매칭만 반환', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { testID: 'btn-0' }),
      makeFiber('Pressable', { testID: 'btn-1' }),
      makeFiber('Pressable', { testID: 'btn-2' }),
    ]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('Pressable:last') as Array<Record<string, unknown>>;
    expect(results.length).toBe(1);
    expect(results[0].testID).toBe('btn-2');
  });
});

describe('querySelector — 계층 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('후손 셀렉터 (공백): "View ScrollView"', () => {
    const root = makeFiber('View', {}, [
      makeFiber('View', {}, [makeFiber('ScrollView', { testID: 'nested' })]),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('View ScrollView') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.testID).toBe('nested');
  });

  it('직접 자식 셀렉터 (>): "View > ScrollView"', () => {
    const root = makeFiber('View', { testID: 'root' }, [
      makeFiber('View', {}, [makeFiber('ScrollView', { testID: 'deep' })]),
      makeFiber('ScrollView', { testID: 'direct' }),
    ]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('View > ScrollView') as Array<Record<string, unknown>>;
    const testIDs = results.map((r) => r.testID);
    expect(testIDs).toContain('direct');
    expect(testIDs).toContain('deep'); // inner View의 직접 자식
  });

  it('다단 계층: "View > View > ScrollView"', () => {
    const root = makeFiber('View', {}, [
      makeFiber('View', {}, [makeFiber('ScrollView', { testID: 'target' })]),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('View > View > ScrollView') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.testID).toBe('target');
  });
});

describe('querySelector — 콤마 (OR) 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('"ScrollView, FlatList" 양쪽 타입 매칭', () => {
    const root = makeFiber('View', {}, [
      makeFiber('ScrollView', { testID: 'sv' }),
      makeFiber('FlatList', { testID: 'fl' }),
      makeFiber(MockText, { children: 'hi' }),
    ]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('ScrollView, FlatList') as Array<Record<string, unknown>>;
    expect(results.length).toBe(2);
    const types = results.map((r) => r.type);
    expect(types).toContain('ScrollView');
    expect(types).toContain('FlatList');
  });
});

describe('querySelector — 반환 형식', () => {
  beforeEach(() => clearMockFiberRoot());

  it('전체 정보 객체 반환', () => {
    const root = makeFiber(
      'Pressable',
      {
        testID: 'submit-btn',
        accessibilityLabel: 'Submit form',
        onPress: () => {},
      },
      [makeFiber(MockText, { children: 'Submit' })]
    );
    setMockFiberRoot(root);
    const result = MCP.querySelector('#submit-btn') as Record<string, unknown>;
    expect(result.uid).toBe('submit-btn');
    expect(result.type).toBe('Pressable');
    expect(result.testID).toBe('submit-btn');
    expect(result.text).toBe('Submit');
    expect(result.accessibilityLabel).toBe('Submit form');
    expect(result.hasOnPress).toBe(true);
    expect(result.hasScrollTo).toBe(false);
  });

  it('testID 없으면 경로 기반 uid', () => {
    const root = makeFiber('View', {}, [makeFiber('View', {})]);
    setMockFiberRoot(root);
    const results = MCP.querySelectorAll('View') as Array<Record<string, unknown>>;
    // 첫 번째는 root → uid "0", 두 번째는 child → uid "0.0"
    expect(results[0].uid).toBe('0');
    expect(results[1].uid).toBe('0.0');
  });

  it('hook 없으면 null / 빈 배열', () => {
    clearMockFiberRoot();
    expect(MCP.querySelector('View')).toBeNull();
    expect(MCP.querySelectorAll('View')).toEqual([]);
  });

  it('빈 셀렉터는 null / 빈 배열', () => {
    expect(MCP.querySelector('')).toBeNull();
    expect(MCP.querySelectorAll('')).toEqual([]);
  });

  it('따옴표 미닫힘(:text("...) 등) 시 파싱 실패 → null / 빈 배열', () => {
    const root = makeFiber('View', {}, [makeFiber('Text', { children: 'Hi' })]);
    setMockFiberRoot(root);
    expect(MCP.querySelector('Text:text("Hi')).toBeNull();
    expect(MCP.querySelectorAll('Text:text("Hi')).toEqual([]);
    expect(MCP.querySelector('View[attr="unclosed')).toBeNull();
    expect(MCP.querySelectorAll('View[attr="unclosed')).toEqual([]);
  });
});

describe('querySelector — 복합 셀렉터', () => {
  beforeEach(() => clearMockFiberRoot());

  it('타입 + :text() + :has-press', () => {
    const root = makeFiber('View', {}, [
      makeFiber('Pressable', { onPress: () => {} }, [makeFiber(MockText, { children: 'Save' })]),
      makeFiber('View', {}, [makeFiber(MockText, { children: 'Save' })]),
    ]);
    setMockFiberRoot(root);
    const result = MCP.querySelector('Pressable:text("Save"):has-press') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.type).toBe('Pressable');
    expect(result.hasOnPress).toBe(true);
  });

  it('Animated.View 같은 닷 이름 지원', () => {
    const AnimatedView = function () {};
    AnimatedView.displayName = 'Animated.View';
    const root = makeFiber(AnimatedView, { testID: 'anim' });
    setMockFiberRoot(root);
    const result = MCP.querySelector('Animated.View') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.type).toBe('Animated.View');
  });

  it(':display-name("...")으로 fiber.type.displayName 매칭', () => {
    const AnimatedComponent = function () {};
    (AnimatedComponent as { displayName?: string }).displayName = 'Animated.View';
    const root = makeFiber(AnimatedComponent, { testID: 'sheet-panel' });
    setMockFiberRoot(root);
    const result = MCP.querySelector(':display-name("Animated.View")') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.testID).toBe('sheet-panel');
  });
});

describe('querySelector — WebView webViewId (ref→id 역조회)', () => {
  const WebViewType = function WebView() {};
  (WebViewType as { displayName?: string }).displayName = 'WebView';

  beforeEach(() => clearMockFiberRoot());

  it('등록된 WebView ref면 결과에 webViewId 포함', () => {
    const mockRef = { injectJavaScript: () => {} };
    const webViewFiber = makeFiber(WebViewType, { testID: 'my-webview' });
    webViewFiber.stateNode = mockRef;

    const root = makeFiber('View', {}, [webViewFiber]);
    setMockFiberRoot(root);
    MCP.registerWebView(mockRef, 'registered-wv-id');

    const result = MCP.querySelector('WebView') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.type).toBe('WebView');
    expect(result.webViewId).toBe('registered-wv-id');

    MCP.unregisterWebView('registered-wv-id');
  });

  it('미등록 WebView ref면 webViewId 없음', () => {
    const mockRef = { injectJavaScript: () => {} };
    const webViewFiber = makeFiber(WebViewType, {});
    webViewFiber.stateNode = mockRef;
    // registerWebView 호출 안 함

    const root = makeFiber('View', {}, [webViewFiber]);
    setMockFiberRoot(root);

    const result = MCP.querySelector('WebView') as Record<string, unknown>;
    expect(result).not.toBeNull();
    expect(result.type).toBe('WebView');
    expect(result.webViewId).toBeUndefined();
  });
});
