import { describe, expect, it } from 'bun:test';
import { VERSION } from '../version.ts';

describe('MCP 서버', () => {
  it('버전이 정의되어 있어야 한다', () => {
    expect(VERSION).toBeDefined();
    expect(typeof VERSION).toBe('string');
  });
});
