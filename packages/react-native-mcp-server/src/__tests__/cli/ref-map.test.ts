/**
 * CLI ref-map 테스트.
 * Snapshot 트리에서 @e1, @e2, ... refs 할당 로직 검증.
 */
import { describe, expect, it } from 'bun:test';
import { assignRefs } from '../../cli/ref-map.js';

const sampleTree = {
  uid: 'root',
  type: 'View',
  testID: 'app-root',
  children: [
    {
      uid: 'header',
      type: 'View',
      testID: 'header',
      children: [
        { uid: 'title', type: 'Text', text: 'Welcome' },
        { uid: 'subtitle', type: 'Text', text: 'Hello world' },
      ],
    },
    {
      uid: 'email-input',
      type: 'TextInput',
      testID: 'email-input',
    },
    {
      uid: 'login-btn',
      type: 'Pressable',
      testID: 'login-btn',
      text: '로그인',
    },
    {
      uid: '1.0.3',
      type: 'Pressable',
      text: '회원가입',
    },
    {
      uid: 'no-info',
      type: 'View',
      children: [{ uid: 'nested-btn', type: 'Button', text: '확인' }],
    },
  ],
};

describe('assignRefs', () => {
  it('전체 모드: 의미 있는 모든 노드에 ref 할당', () => {
    const { refs, lines } = assignRefs(sampleTree, false);

    // refs에 @e1부터 순번이 할당되어야 함
    expect(Object.keys(refs).length).toBeGreaterThan(0);
    expect(refs['@e1']).toBeDefined();

    // root 노드가 @e1
    expect(refs['@e1']!.type).toBe('View');
    expect(refs['@e1']!.testID).toBe('app-root');

    // lines가 생성되어야 함
    expect(lines.length).toBeGreaterThan(0);
    expect(lines[0]).toContain('@e1');
    expect(lines[0]).toContain('View');
  });

  it('interactive 모드: interactive 요소만 포함', () => {
    const { refs, lines } = assignRefs(sampleTree, true);

    // TextInput, Pressable, Button만 포함
    const types = Object.values(refs).map((r) => r.type);
    for (const t of types) {
      // root(depth=0)는 항상 포함, 나머지는 interactive만
      if (t === 'View') continue; // root
      expect(
        [
          'TextInput',
          'Pressable',
          'Button',
          'TouchableOpacity',
          'TouchableHighlight',
          'Switch',
        ].includes(t)
      ).toBe(true);
    }

    // Text 노드는 포함되지 않아야 함
    const hasText = Object.values(refs).some((r) => r.type === 'Text');
    expect(hasText).toBe(false);
  });

  it('ref에 uid, type, testID, text 저장', () => {
    const { refs } = assignRefs(sampleTree, false);

    // testID가 있는 요소
    const loginRef = Object.values(refs).find((r) => r.testID === 'login-btn');
    expect(loginRef).toBeDefined();
    expect(loginRef!.uid).toBe('login-btn');
    expect(loginRef!.type).toBe('Pressable');
    expect(loginRef!.text).toBe('로그인');

    // testID가 없는 요소
    const signupRef = Object.values(refs).find((r) => r.text === '회원가입');
    expect(signupRef).toBeDefined();
    expect(signupRef!.uid).toBe('1.0.3');
    expect(signupRef!.testID).toBeUndefined();
  });

  it('depth-first 순회 순서', () => {
    const { lines } = assignRefs(sampleTree, false);

    // @e1이 @e2보다 먼저, 형제는 선언 순서
    const refOrder = lines.map((l) => l.match(/@e\d+/)?.[0]).filter(Boolean);
    expect(refOrder[0]).toBe('@e1');

    // 순번이 증가해야 함
    for (let i = 1; i < refOrder.length; i++) {
      const prev = parseInt(refOrder[i - 1]!.replace('@e', ''), 10);
      const curr = parseInt(refOrder[i]!.replace('@e', ''), 10);
      expect(curr).toBe(prev + 1);
    }
  });

  it('빈 트리', () => {
    const { refs, lines } = assignRefs({ type: 'View', uid: 'root' }, false);
    // root만 있어도 @e1 할당
    expect(refs['@e1']).toBeDefined();
    expect(lines.length).toBe(1);
  });

  it('lines 포맷: ref + indent + type + testID + text', () => {
    const { lines } = assignRefs(sampleTree, false);

    // root: "@e1   View #app-root"
    expect(lines[0]).toMatch(/^@e1\s+View #app-root$/);

    // text가 있는 줄: 따옴표로 감싸져야 함
    const textLine = lines.find((l) => l.includes('"Welcome"'));
    expect(textLine).toBeDefined();
  });
});
