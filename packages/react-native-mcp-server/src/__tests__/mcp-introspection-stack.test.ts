/**
 * getSourceRefFromStack 단위 테스트
 * 스택 문자열에서 (url:line:column) 프레임 추출 검증.
 */

import { describe, expect, it } from 'bun:test';
import { getSourceRefFromStack } from '../runtime/mcp-introspection';

describe('getSourceRefFromStack', () => {
  it('빈 문자열이면 빈 배열 반환', () => {
    expect(getSourceRefFromStack('')).toEqual([]);
  });

  it('공백만 있으면 빈 배열 반환', () => {
    expect(getSourceRefFromStack('   ')).toEqual([]);
  });

  it('한 개의 (url:line:column) 프레임 추출', () => {
    const stack = ' at fn (http://localhost:8081/index.bundle?platform=ios:123:45)';
    expect(getSourceRefFromStack(stack)).toEqual([
      { bundleUrl: 'http://localhost:8081/index.bundle?platform=ios', line: 123, column: 45 },
    ]);
  });

  it('여러 프레임을 순서대로 추출', () => {
    const stack =
      ' at render (http://host:25822/bar.js:10:20)\n at App (http://host:25822/App.js:7284:69)';
    expect(getSourceRefFromStack(stack)).toEqual([
      { bundleUrl: 'http://host:25822/bar.js', line: 10, column: 20 },
      { bundleUrl: 'http://host:25822/App.js', line: 7284, column: 69 },
    ]);
  });

  it('괄호 안 url:line:column 패턴만 매칭', () => {
    const stack = ' at Component (file:///src/App.tsx:42:8)';
    expect(getSourceRefFromStack(stack)).toEqual([
      { bundleUrl: 'file:///src/App.tsx', line: 42, column: 8 },
    ]);
  });

  it('매칭되는 패턴이 없으면 빈 배열 반환', () => {
    expect(getSourceRefFromStack('Error: something')).toEqual([]);
    expect(getSourceRefFromStack(' at fn (no-colon-here)')).toEqual([]);
  });

  it('매칭되는 줄만 추출하고 나머지는 스킵 (수정 감지)', () => {
    const stack = [
      ' at A (http://host/a.js:1:2)',
      ' at B (no-colon-no-line-column)', // 패턴 불일치 → 스킵
      ' at C (http://host/c.js:3:4)',
    ].join('\n');
    expect(getSourceRefFromStack(stack)).toEqual([
      { bundleUrl: 'http://host/a.js', line: 1, column: 2 },
      { bundleUrl: 'http://host/c.js', line: 3, column: 4 },
    ]);
  });

  it('동일 deltaId처럼 유효한 프레임만 수집 (수정 감지 안 한 건 그대로 반환)', () => {
    const stack = ' at App (http://localhost:8081/index.bundle:10:20)';
    const out = getSourceRefFromStack(stack);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      bundleUrl: 'http://localhost:8081/index.bundle',
      line: 10,
      column: 20,
    });
  });

  it('non-string 입력은 빈 배열 반환 (타입 가드)', () => {
    // @ts-expect-error 테스트용 비문자열
    expect(getSourceRefFromStack(null)).toEqual([]);
    // @ts-expect-error 테스트용 비문자열
    expect(getSourceRefFromStack(undefined)).toEqual([]);
  });
});
