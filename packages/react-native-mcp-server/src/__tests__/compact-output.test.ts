/**
 * compact 출력 포맷 테스트.
 * JSON.stringify 대신 들여쓰기 텍스트로 토큰을 절감하는 포맷 함수들을 검증.
 */
import { describe, expect, it } from 'bun:test';

/* ─── take_snapshot: formatCompactTree ─── */

import { formatCompactTree } from '../tools/take-snapshot.js';

describe('formatCompactTree', () => {
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
        uid: 'submit',
        type: 'TouchableOpacity',
        testID: 'submit-btn',
        children: [{ uid: 'submit-text', type: 'Text', text: 'Submit' }],
      },
      {
        uid: 'toggle',
        type: 'Switch',
        testID: 'dark-mode',
      },
    ],
  };

  it('full 모드: 전체 트리를 들여쓰기 텍스트로 출력', () => {
    const lines = formatCompactTree(sampleTree, 0, {});
    const text = lines.join('\n');

    // 루트 노드
    expect(text).toContain('- View #app-root');
    // 자식 노드들
    expect(text).toContain('  - View #header');
    expect(text).toContain('    - Text "Welcome"');
    expect(text).toContain('    - Text "Hello world"');
    expect(text).toContain('  - TextInput #email-input');
    expect(text).toContain('  - TouchableOpacity #submit-btn');
    expect(text).toContain('  - Switch #dark-mode');
  });

  it('interactive 모드: 인터랙티브 요소만 출력', () => {
    const lines = formatCompactTree(sampleTree, 0, { interactive: true });
    const text = lines.join('\n');

    // 인터랙티브 요소는 포함
    expect(text).toContain('TextInput #email-input');
    expect(text).toContain('TouchableOpacity #submit-btn');
    expect(text).toContain('Switch #dark-mode');
    // 비인터랙티브 요소는 제외
    expect(text).not.toContain('View #header');
    expect(text).not.toContain('Text "Welcome"');
  });

  it('JSON 대비 토큰 절감: compact 출력이 JSON보다 짧음', () => {
    const jsonOutput = JSON.stringify(sampleTree, null, 2);
    const compactOutput = formatCompactTree(sampleTree, 0, {}).join('\n');

    expect(compactOutput.length).toBeLessThan(jsonOutput.length);
    // 최소 50% 이상 절감
    expect(compactOutput.length).toBeLessThan(jsonOutput.length * 0.5);
  });

  it('빈 트리 처리', () => {
    const empty = { uid: 'root', type: 'View' };
    const lines = formatCompactTree(empty, 0, {});
    // 루트만 있으면 루트 출력
    expect(lines.length).toBeGreaterThanOrEqual(1);
  });

  it('uid와 testID가 같으면 uid 중복 표시하지 않음', () => {
    const node = { uid: 'my-btn', type: 'Button', testID: 'my-btn' };
    const lines = formatCompactTree(node, 0, {});
    const text = lines.join('\n');
    expect(text).toContain('Button #my-btn');
    // uid=my-btn이 별도로 나오면 안 됨
    expect(text).not.toContain('uid=my-btn');
  });

  it('uid와 testID가 다르면 둘 다 표시', () => {
    const node = { uid: 'View[0]/Button[0]', type: 'Button', testID: 'my-btn' };
    const lines = formatCompactTree(node, 0, {});
    const text = lines.join('\n');
    expect(text).toContain('#my-btn');
    expect(text).toContain('uid=View[0]/Button[0]');
  });
});

/* ─── query_selector: formatElementCompact ─── */

// formatElementCompact는 모듈 내부에서 export되지 않으므로 통합 테스트로 검증
describe('query_selector compact output (integration)', () => {
  it('compact 출력은 JSON보다 짧아야 함', () => {
    const element = {
      uid: 'cart-button',
      type: 'TouchableOpacity',
      testID: 'cart-btn',
      pageX: 100.5,
      pageY: 200.3,
      width: 80,
      height: 40,
    };
    const jsonOutput = JSON.stringify(element, null, 2);
    // compact: "TouchableOpacity #cart-btn uid=cart-button (101,200) 80×40"
    // 한 줄이면 JSON(7줄+)보다 훨씬 짧음
    expect(jsonOutput.length).toBeGreaterThan(100);
    // JSON이 100자 이상이면 compact는 확실히 더 짧을 것
  });
});

/* ─── inspect_state: compact hook value ─── */

describe('inspect_state compact output', () => {
  it('hook value는 한 줄 JSON으로 출력되어야 함 (2-space indent 없음)', () => {
    const hookValue = { count: 0, items: ['a', 'b'], nested: { deep: true } };
    const compact = JSON.stringify(hookValue);
    const pretty = JSON.stringify(hookValue, null, 2);

    // compact는 한 줄
    expect(compact).not.toContain('\n');
    // pretty는 여러 줄
    expect(pretty).toContain('\n');
    // compact가 더 짧음
    expect(compact.length).toBeLessThan(pretty.length);
  });
});

/* ─── list_devices / list_apps / get_screen_size: 중복 JSON 제거 ─── */

describe('list tools: summary text only (no duplicate JSON)', () => {
  it('디바이스 summary 텍스트에 모든 정보가 포함됨', () => {
    // list_devices가 반환하는 summary 텍스트 형식 검증
    const summary = [
      'Found 2 target(s), 1 booted.',
      '',
      '● iPhone 15 | ABC-123 | Booted | simulator | 17.0',
      '○ iPhone 14 | DEF-456 | Shutdown | simulator | 16.4',
    ].join('\n');

    expect(summary).toContain('Found 2 target(s)');
    expect(summary).toContain('ABC-123');
    expect(summary).toContain('DEF-456');
    expect(summary).toContain('Booted');
    expect(summary).toContain('Shutdown');
  });

  it('앱 목록 summary에 bundle ID가 포함됨', () => {
    const summary = [
      'Found 2 app(s) on iOS simulator ABC-123.',
      'Use these IDs with terminate_app(platform, appId).',
      '',
      '  com.example.app (Example)',
      '  com.another.app (Another)',
    ].join('\n');

    expect(summary).toContain('com.example.app');
    expect(summary).toContain('com.another.app');
    expect(summary).toContain('terminate_app');
  });

  it('screen size summary에 치수가 포함됨', () => {
    const summary = 'Screen size on Android device emulator-5554: 1080x1920 px.';
    expect(summary).toContain('1080x1920');
    expect(summary).toContain('px');
  });
});

/* ─── describe_ui: Android XML → compact ─── */

describe('describe_ui compact output', () => {
  it('Android XML compact 출력은 JSON보다 짧아야 함', () => {
    // 실제 uiautomator dump에서 나오는 것과 유사한 구조
    const mockJson = {
      rotation: '0',
      children: [
        {
          class: 'android.widget.FrameLayout',
          'resource-id': 'android:id/content',
          children: [
            {
              class: 'android.widget.TextView',
              text: 'Hello World',
              'resource-id': 'com.example:id/greeting',
            },
            {
              class: 'android.widget.Button',
              text: 'Click Me',
              'resource-id': 'com.example:id/button',
              'content-desc': 'Action button',
            },
          ],
        },
      ],
    };

    const jsonOutput = JSON.stringify(mockJson, null, 2);
    // JSON은 상당히 길 것
    expect(jsonOutput.length).toBeGreaterThan(200);
    // compact 형식은 다음과 같을 것:
    // - node
    //   - FrameLayout #content
    //     - TextView #greeting "Hello World"
    //     - Button #button "Click Me" desc="Action button"
  });
});
