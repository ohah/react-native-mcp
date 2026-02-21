import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach } from 'bun:test';
import { parseFile } from '../../test/parser.js';

const tmpFile = join(tmpdir(), `parser-steps-test-${Date.now()}.yaml`);

afterEach(() => {
  try {
    unlinkSync(tmpFile);
  } catch {}
});

function writeAndParse(stepsYaml: string) {
  const yaml = `name: test\nconfig:\n  platform: ios\nsteps:\n${stepsYaml}`;
  writeFileSync(tmpFile, yaml);
  return parseFile(tmpFile);
}

describe('back / home / hideKeyboard (parameterless steps)', () => {
  it('YAML null (- back:) → { back: null }', () => {
    const suite = writeAndParse('  - back:');
    expect(suite.steps[0]).toEqual({ back: null });
  });

  it('YAML empty object (- back: {}) → { back: {} }', () => {
    const suite = writeAndParse('  - back: {}');
    expect(suite.steps[0]).toEqual({ back: {} });
  });

  it('home 파싱', () => {
    const suite = writeAndParse('  - home:');
    expect(suite.steps[0]).toEqual({ home: null });
  });

  it('hideKeyboard 파싱', () => {
    const suite = writeAndParse('  - hideKeyboard:');
    expect(suite.steps[0]).toEqual({ hideKeyboard: null });
  });

  it('back, home, hideKeyboard가 서로 구분됨', () => {
    const suite = writeAndParse('  - back:\n  - home:\n  - hideKeyboard:');
    expect(suite.steps).toEqual([{ back: null }, { home: null }, { hideKeyboard: null }]);
  });
});

describe('longPress', () => {
  it('selector + duration', () => {
    const suite = writeAndParse("  - longPress: { selector: '#btn', duration: 1200 }");
    expect(suite.steps[0]).toEqual({ longPress: { selector: '#btn', duration: 1200 } });
  });

  it('duration 생략 가능', () => {
    const suite = writeAndParse("  - longPress: { selector: '#btn' }");
    expect(suite.steps[0]).toEqual({ longPress: { selector: '#btn' } });
  });

  it('selector 누락 시 에러', () => {
    expect(() => writeAndParse('  - longPress: { duration: 500 }')).toThrow();
  });
});

describe('addMedia', () => {
  it('paths 배열 파싱', () => {
    const suite = writeAndParse("  - addMedia: { paths: ['/tmp/a.jpg', '/tmp/b.png'] }");
    expect(suite.steps[0]).toEqual({ addMedia: { paths: ['/tmp/a.jpg', '/tmp/b.png'] } });
  });

  it('paths 빈 배열이면 에러 (min 1)', () => {
    expect(() => writeAndParse('  - addMedia: { paths: [] }')).toThrow();
  });

  it('paths 누락 시 에러', () => {
    expect(() => writeAndParse('  - addMedia: {}')).toThrow();
  });
});

describe('clearText', () => {
  it('selector 파싱', () => {
    const suite = writeAndParse("  - clearText: { selector: '#email' }");
    expect(suite.steps[0]).toEqual({ clearText: { selector: '#email' } });
  });

  it('selector 누락 시 에러', () => {
    expect(() => writeAndParse('  - clearText: {}')).toThrow();
  });
});

describe('doubleTap', () => {
  it('selector + interval', () => {
    const suite = writeAndParse("  - doubleTap: { selector: '#item', interval: 100 }");
    expect(suite.steps[0]).toEqual({ doubleTap: { selector: '#item', interval: 100 } });
  });

  it('interval 생략 가능', () => {
    const suite = writeAndParse("  - doubleTap: { selector: '#item' }");
    expect(suite.steps[0]).toEqual({ doubleTap: { selector: '#item' } });
  });

  it('selector 누락 시 에러', () => {
    expect(() => writeAndParse('  - doubleTap: { interval: 100 }')).toThrow();
  });
});

describe('assertValue', () => {
  it('selector + expected', () => {
    const suite = writeAndParse(
      "  - assertValue: { selector: '#email', expected: 'test@test.com' }"
    );
    expect(suite.steps[0]).toEqual({
      assertValue: { selector: '#email', expected: 'test@test.com' },
    });
  });

  it('selector 누락 시 에러', () => {
    expect(() => writeAndParse("  - assertValue: { expected: 'hello' }")).toThrow();
  });

  it('expected 누락 시 에러', () => {
    expect(() => writeAndParse("  - assertValue: { selector: '#email' }")).toThrow();
  });
});

describe('기존 스텝과 혼합', () => {
  it('새 스텝과 기존 스텝이 함께 파싱됨', () => {
    const suite = writeAndParse(
      [
        "  - tap: { selector: '#btn' }",
        '  - back:',
        '  - wait: 500',
        "  - longPress: { selector: '#item' }",
        "  - assertText: { text: 'OK' }",
        '  - home:',
      ].join('\n')
    );
    expect(suite.steps).toHaveLength(6);
    expect('tap' in suite.steps[0]!).toBe(true);
    expect('back' in suite.steps[1]!).toBe(true);
    expect('wait' in suite.steps[2]!).toBe(true);
    expect('longPress' in suite.steps[3]!).toBe(true);
    expect('assertText' in suite.steps[4]!).toBe(true);
    expect('home' in suite.steps[5]!).toBe(true);
  });
});

/* ================================================================== */
/*  Phase 2 — 흐름 제어 스텝                                          */
/* ================================================================== */

describe('${VAR} 환경 변수 치환', () => {
  it('process.env 값으로 치환', () => {
    process.env.__TEST_VAR__ = 'hello@test.com';
    try {
      const suite = writeAndParse("  - typeText: { selector: '#email', text: '${__TEST_VAR__}' }");
      expect(suite.steps[0]).toEqual({
        typeText: { selector: '#email', text: 'hello@test.com' },
      });
    } finally {
      delete process.env.__TEST_VAR__;
    }
  });

  it('CLI envVars가 process.env보다 우선', () => {
    process.env.__TEST_VAR2__ = 'from-process';
    try {
      const yaml = `name: test\nconfig:\n  platform: ios\nsteps:\n  - typeText: { selector: '#x', text: '\${__TEST_VAR2__}' }`;
      writeFileSync(tmpFile, yaml);
      const suite = parseFile(tmpFile, { __TEST_VAR2__: 'from-cli' });
      expect(suite.steps[0]).toEqual({
        typeText: { selector: '#x', text: 'from-cli' },
      });
    } finally {
      delete process.env.__TEST_VAR2__;
    }
  });

  it('정의되지 않은 변수는 빈 문자열로 치환', () => {
    const suite = writeAndParse("  - typeText: { selector: '#x', text: '${UNDEFINED_VAR_XYZ}' }");
    expect(suite.steps[0]).toEqual({
      typeText: { selector: '#x', text: '' },
    });
  });

  it('selector 내 변수도 치환됨', () => {
    process.env.__TEST_SEL__ = 'email-input';
    try {
      const suite = writeAndParse("  - tap: { selector: '#${__TEST_SEL__}' }");
      expect(suite.steps[0]).toEqual({ tap: { selector: '#email-input' } });
    } finally {
      delete process.env.__TEST_SEL__;
    }
  });
});

describe('repeat', () => {
  it('times + steps 파싱', () => {
    const suite = writeAndParse(
      [
        '  - repeat:',
        '      times: 3',
        '      steps:',
        "        - tap: { selector: '#btn' }",
        '        - wait: 100',
      ].join('\n')
    );
    expect(suite.steps[0]).toEqual({
      repeat: {
        times: 3,
        steps: [{ tap: { selector: '#btn' } }, { wait: 100 }],
      },
    });
  });

  it('중첩 repeat 파싱', () => {
    const suite = writeAndParse(
      [
        '  - repeat:',
        '      times: 2',
        '      steps:',
        '        - repeat:',
        '            times: 3',
        '            steps:',
        "              - tap: { selector: '#inner' }",
      ].join('\n')
    );
    const outer = (suite.steps[0] as any).repeat;
    expect(outer.times).toBe(2);
    const inner = outer.steps[0].repeat;
    expect(inner.times).toBe(3);
    expect(inner.steps[0]).toEqual({ tap: { selector: '#inner' } });
  });

  it('steps 빈 배열이면 에러 (min 1)', () => {
    expect(() =>
      writeAndParse(['  - repeat:', '      times: 3', '      steps: []'].join('\n'))
    ).toThrow();
  });

  it('times 누락 시 에러', () => {
    expect(() =>
      writeAndParse(['  - repeat:', '      steps:', "        - tap: { selector: '#a' }"].join('\n'))
    ).toThrow();
  });
});

describe('runFlow', () => {
  it('문자열 경로 파싱', () => {
    const suite = writeAndParse('  - runFlow: ./shared/login.yaml');
    expect(suite.steps[0]).toEqual({ runFlow: './shared/login.yaml' });
  });

  it('빈 문자열도 파싱됨 (런타임에서 에러 처리)', () => {
    // 빈 경로는 Zod string()에서 통과 — 파일 미존재는 런타임 에러
    const suite = writeAndParse("  - runFlow: ''");
    expect(suite.steps[0]).toEqual({ runFlow: '' });
  });
});

describe('if (조건부 실행)', () => {
  it('platform 조건 + steps', () => {
    const suite = writeAndParse(
      ['  - if:', '      platform: android', '      steps:', '        - back:'].join('\n')
    );
    expect(suite.steps[0]).toEqual({
      if: { platform: 'android', steps: [{ back: null }] },
    });
  });

  it('visible 조건 + steps', () => {
    const suite = writeAndParse(
      [
        '  - if:',
        "      visible: '#popup'",
        '      steps:',
        "        - tap: { selector: '#close' }",
      ].join('\n')
    );
    expect(suite.steps[0]).toEqual({
      if: { visible: '#popup', steps: [{ tap: { selector: '#close' } }] },
    });
  });

  it('platform + visible 동시 사용', () => {
    const suite = writeAndParse(
      [
        '  - if:',
        '      platform: ios',
        "      visible: '#tutorial'",
        '      steps:',
        "        - tap: { selector: '#skip' }",
      ].join('\n')
    );
    const step = suite.steps[0] as any;
    expect(step.if.platform).toBe('ios');
    expect(step.if.visible).toBe('#tutorial');
    expect(step.if.steps).toHaveLength(1);
  });

  it('잘못된 platform 값이면 에러', () => {
    expect(() =>
      writeAndParse(
        ['  - if:', '      platform: windows', '      steps:', '        - back:'].join('\n')
      )
    ).toThrow();
  });

  it('steps 누락 시 에러', () => {
    expect(() => writeAndParse(['  - if:', '      platform: ios'].join('\n'))).toThrow();
  });

  it('if 내부에 repeat 중첩 가능', () => {
    const suite = writeAndParse(
      [
        '  - if:',
        '      platform: ios',
        '      steps:',
        '        - repeat:',
        '            times: 2',
        '            steps:',
        "              - tap: { selector: '#x' }",
      ].join('\n')
    );
    const ifStep = (suite.steps[0] as any).if;
    expect(ifStep.steps[0].repeat.times).toBe(2);
  });
});

describe('retry', () => {
  it('times + steps 파싱', () => {
    const suite = writeAndParse(
      [
        '  - retry:',
        '      times: 3',
        '      steps:',
        "        - tap: { selector: '#flaky' }",
        "        - waitForVisible: { selector: '#result', timeout: 2000 }",
      ].join('\n')
    );
    expect(suite.steps[0]).toEqual({
      retry: {
        times: 3,
        steps: [
          { tap: { selector: '#flaky' } },
          { waitForVisible: { selector: '#result', timeout: 2000 } },
        ],
      },
    });
  });

  it('steps 빈 배열이면 에러', () => {
    expect(() =>
      writeAndParse(['  - retry:', '      times: 2', '      steps: []'].join('\n'))
    ).toThrow();
  });

  it('times 누락 시 에러', () => {
    expect(() =>
      writeAndParse(['  - retry:', '      steps:', "        - tap: { selector: '#a' }"].join('\n'))
    ).toThrow();
  });
});

/* ================================================================== */
/*  Network Mocking 스텝                                               */
/* ================================================================== */

describe('mockNetwork', () => {
  it('전체 옵션 파싱', () => {
    const suite = writeAndParse(
      [
        '  - mockNetwork:',
        '      urlPattern: "/api/users"',
        '      method: GET',
        '      status: 200',
        '      body: \'{"users": []}\'',
        '      headers:',
        '        Content-Type: application/json',
        '      delay: 100',
      ].join('\n')
    );
    expect(suite.steps[0]).toEqual({
      mockNetwork: {
        urlPattern: '/api/users',
        method: 'GET',
        status: 200,
        body: '{"users": []}',
        headers: { 'Content-Type': 'application/json' },
        delay: 100,
      },
    });
  });

  it('urlPattern만 필수 — 나머지 생략 가능', () => {
    const suite = writeAndParse('  - mockNetwork: { urlPattern: "/api/test" }');
    expect(suite.steps[0]).toEqual({
      mockNetwork: { urlPattern: '/api/test' },
    });
  });

  it('isRegex 옵션', () => {
    const suite = writeAndParse(
      [
        '  - mockNetwork:',
        '      urlPattern: "^https://api\\\\.example\\\\.com/error"',
        '      isRegex: true',
        '      status: 500',
        '      body: \'{"error": "Server Error"}\'',
      ].join('\n')
    );
    const step = suite.steps[0] as any;
    expect(step.mockNetwork.isRegex).toBe(true);
    expect(step.mockNetwork.status).toBe(500);
  });

  it('urlPattern 누락 시 에러', () => {
    expect(() => writeAndParse('  - mockNetwork: { status: 200 }')).toThrow();
  });

  it('statusText 옵션', () => {
    const suite = writeAndParse(
      "  - mockNetwork: { urlPattern: '/api', status: 404, statusText: 'Not Found' }"
    );
    const step = suite.steps[0] as any;
    expect(step.mockNetwork.statusText).toBe('Not Found');
  });
});

describe('clearNetworkMocks', () => {
  it('YAML null (- clearNetworkMocks:) → { clearNetworkMocks: null }', () => {
    const suite = writeAndParse('  - clearNetworkMocks:');
    expect(suite.steps[0]).toEqual({ clearNetworkMocks: null });
  });

  it('YAML empty object (- clearNetworkMocks: {}) → { clearNetworkMocks: {} }', () => {
    const suite = writeAndParse('  - clearNetworkMocks: {}');
    expect(suite.steps[0]).toEqual({ clearNetworkMocks: {} });
  });
});

describe('mockNetwork + clearNetworkMocks 혼합', () => {
  it('mockNetwork → tap → clearNetworkMocks 순서 파싱', () => {
    const suite = writeAndParse(
      [
        '  - mockNetwork: { urlPattern: "/api/data", status: 200 }',
        "  - tap: { selector: '#btn' }",
        '  - clearNetworkMocks:',
      ].join('\n')
    );
    expect(suite.steps).toHaveLength(3);
    expect('mockNetwork' in suite.steps[0]!).toBe(true);
    expect('tap' in suite.steps[1]!).toBe(true);
    expect('clearNetworkMocks' in suite.steps[2]!).toBe(true);
  });
});

/* ================================================================== */
/*  Visual Regression — compareScreenshot                              */
/* ================================================================== */

describe('compareScreenshot', () => {
  it('전체 화면 비교 (baseline + threshold)', () => {
    const suite = writeAndParse(
      "  - compareScreenshot: { baseline: './baselines/home.png', threshold: 0.01 }"
    );
    expect(suite.steps[0]).toEqual({
      compareScreenshot: { baseline: './baselines/home.png', threshold: 0.01 },
    });
  });

  it('selector로 컴포넌트 비교', () => {
    const suite = writeAndParse(
      "  - compareScreenshot: { baseline: './baselines/card.png', selector: '#product-card', threshold: 0.005 }"
    );
    expect(suite.steps[0]).toEqual({
      compareScreenshot: {
        baseline: './baselines/card.png',
        selector: '#product-card',
        threshold: 0.005,
      },
    });
  });

  it('update: true로 베이스라인 갱신', () => {
    const suite = writeAndParse(
      "  - compareScreenshot: { baseline: './baselines/card.png', selector: '#card', update: true }"
    );
    const step = suite.steps[0] as any;
    expect(step.compareScreenshot.update).toBe(true);
    expect(step.compareScreenshot.baseline).toBe('./baselines/card.png');
  });

  it('baseline만 필수 — threshold, selector, update 생략 가능', () => {
    const suite = writeAndParse("  - compareScreenshot: { baseline: './baselines/screen.png' }");
    expect(suite.steps[0]).toEqual({
      compareScreenshot: { baseline: './baselines/screen.png' },
    });
  });

  it('baseline 누락 시 에러', () => {
    expect(() => writeAndParse("  - compareScreenshot: { selector: '#btn' }")).toThrow();
  });

  it('threshold 범위 초과 시 에러', () => {
    expect(() =>
      writeAndParse("  - compareScreenshot: { baseline: './b.png', threshold: 2 }")
    ).toThrow();
  });

  it('threshold 음수 시 에러', () => {
    expect(() =>
      writeAndParse("  - compareScreenshot: { baseline: './b.png', threshold: -0.1 }")
    ).toThrow();
  });
});

describe('startRecording / stopRecording (Video)', () => {
  it('startRecording path 지정 파싱', () => {
    const suite = writeAndParse("  - startRecording: { path: './artifacts/rec.mp4' }");
    expect(suite.steps[0]).toEqual({ startRecording: { path: './artifacts/rec.mp4' } });
  });

  it('startRecording path 생략 가능', () => {
    const suite = writeAndParse('  - startRecording: {}');
    expect(suite.steps[0]).toEqual({ startRecording: {} });
  });

  it('stopRecording null 파싱', () => {
    const suite = writeAndParse('  - stopRecording:');
    expect(suite.steps[0]).toEqual({ stopRecording: null });
  });

  it('stopRecording 빈 객체 파싱', () => {
    const suite = writeAndParse('  - stopRecording: {}');
    expect(suite.steps[0]).toEqual({ stopRecording: {} });
  });

  it('startRecording → stopRecording 순서 파싱', () => {
    const suite = writeAndParse(
      [
        "  - startRecording: { path: './out.mp4' }",
        "  - tap: { selector: '#btn' }",
        '  - stopRecording:',
      ].join('\n')
    );
    expect(suite.steps).toHaveLength(3);
    expect(suite.steps[0]).toEqual({ startRecording: { path: './out.mp4' } });
    expect('tap' in suite.steps[1]!).toBe(true);
    expect(suite.steps[2]).toEqual({ stopRecording: null });
  });
});

describe('Phase 2 스텝 혼합', () => {
  it('흐름 제어 + 기존 스텝이 함께 파싱됨', () => {
    const suite = writeAndParse(
      [
        "  - tap: { selector: '#start' }",
        '  - repeat:',
        '      times: 2',
        '      steps:',
        "        - swipe: { selector: '#list', direction: up }",
        '  - if:',
        '      platform: ios',
        '      steps:',
        '        - hideKeyboard:',
        '  - runFlow: ./sub.yaml',
        '  - retry:',
        '      times: 1',
        '      steps:',
        "        - assertText: { text: 'done' }",
      ].join('\n')
    );
    expect(suite.steps).toHaveLength(5);
    expect('tap' in suite.steps[0]!).toBe(true);
    expect('repeat' in suite.steps[1]!).toBe(true);
    expect('if' in suite.steps[2]!).toBe(true);
    expect('runFlow' in suite.steps[3]!).toBe(true);
    expect('retry' in suite.steps[4]!).toBe(true);
  });
});
