import { describe, expect, it } from 'bun:test';
import { buildPressByLabelEvalCode } from '../tools/click-by-label.js';

describe('click_by_label — buildPressByLabelEvalCode', () => {
  it('label만 넣으면 index 인자 없이 pressByLabel 호출 코드 생성', () => {
    const code = buildPressByLabelEvalCode('탭:');
    expect(code).toContain('pressByLabel("탭:")');
    expect(code).not.toContain('pressByLabel("탭:",');
  });

  it('label과 index 넣으면 n번째 매칭 인자 포함', () => {
    const code = buildPressByLabelEvalCode('탭:', 0);
    expect(code).toContain('pressByLabel("탭:", 0)');
  });

  it('index 1이면 코드에 ", 1" 포함', () => {
    const code = buildPressByLabelEvalCode('클릭:', 1);
    expect(code).toContain('pressByLabel("클릭:", 1)');
  });

  it('__REACT_NATIVE_MCP__ 체크 및 호출 래퍼 포함', () => {
    const code = buildPressByLabelEvalCode('Submit');
    expect(code).toContain('__REACT_NATIVE_MCP__');
    expect(code).toContain('pressByLabel');
    expect(code).toMatch(/return.*pressByLabel\(.*\)/);
  });
});
