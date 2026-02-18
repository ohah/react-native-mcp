import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it, afterEach } from 'bun:test';
import { parseFile } from '../parser.js';

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

describe('assertHasText', () => {
  it('text + selector', () => {
    const suite = writeAndParse("  - assertHasText: { text: 'hello', selector: '#msg' }");
    expect(suite.steps[0]).toEqual({ assertHasText: { text: 'hello', selector: '#msg' } });
  });

  it('selector 생략 가능', () => {
    const suite = writeAndParse("  - assertHasText: { text: 'hello' }");
    expect(suite.steps[0]).toEqual({ assertHasText: { text: 'hello' } });
  });

  it('text 누락 시 에러', () => {
    expect(() => writeAndParse('  - assertHasText: {}')).toThrow();
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
        "  - assertHasText: { text: 'OK' }",
        '  - home:',
      ].join('\n')
    );
    expect(suite.steps).toHaveLength(6);
    expect('tap' in suite.steps[0]!).toBe(true);
    expect('back' in suite.steps[1]!).toBe(true);
    expect('wait' in suite.steps[2]!).toBe(true);
    expect('longPress' in suite.steps[3]!).toBe(true);
    expect('assertHasText' in suite.steps[4]!).toBe(true);
    expect('home' in suite.steps[5]!).toBe(true);
  });
});
