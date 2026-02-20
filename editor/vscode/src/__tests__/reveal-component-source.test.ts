/**
 * reveal-component-source — findSourceLine 순수 함수 테스트
 */

import { describe, expect, it } from 'bun:test';
import { findSourceLine, type FileContent } from '../extension/reveal-component-source-logic';

describe('findSourceLine', () => {
  it('identifier가 비어있거나 문자열이 아니면 null 반환', () => {
    expect(findSourceLine('', [{ uri: 'file:///a.tsx', text: 'testID="x"' }])).toBeNull();
    expect(findSourceLine(null as any, [])).toBeNull();
    expect(findSourceLine(undefined as any, [])).toBeNull();
  });

  it('testID와 identifier가 같은 줄에 있으면 해당 파일·라인 반환', () => {
    const files: FileContent[] = [
      { uri: 'file:///app.tsx', text: 'const x = 1;\n<Button testID="submit-btn" />\n' },
    ];
    const result = findSourceLine('submit-btn', files);
    expect(result).not.toBeNull();
    expect(result!.uri).toBe('file:///app.tsx');
    expect(result!.lineIndex).toBe(1);
    expect(result!.lineLength).toBe(30);
  });

  it('여러 파일 중 첫 번째 매칭 반환', () => {
    const files: FileContent[] = [
      { uri: 'file:///a.tsx', text: 'no match' },
      { uri: 'file:///b.tsx', text: '<View testID="target" />' },
      { uri: 'file:///c.tsx', text: '<Text testID="target" />' },
    ];
    const result = findSourceLine('target', files);
    expect(result).not.toBeNull();
    expect(result!.uri).toBe('file:///b.tsx');
    expect(result!.lineIndex).toBe(0);
  });

  it('identifier는 있지만 testID가 없는 줄은 무시', () => {
    const files: FileContent[] = [
      { uri: 'file:///a.tsx', text: 'const id = "submit-btn";\n<Button testID="other" />' },
    ];
    const result = findSourceLine('submit-btn', files);
    expect(result).toBeNull();
  });

  it('testID가 있지만 identifier가 다른 줄은 무시', () => {
    const files: FileContent[] = [{ uri: 'file:///a.tsx', text: '<Button testID="cancel-btn" />' }];
    const result = findSourceLine('submit-btn', files);
    expect(result).toBeNull();
  });

  it('파일 목록이 비어있으면 null', () => {
    expect(findSourceLine('submit-btn', [])).toBeNull();
  });

  it('text에 identifier가 전혀 없으면 null', () => {
    const files: FileContent[] = [{ uri: 'file:///a.tsx', text: '<Button testID="other" />' }];
    expect(findSourceLine('submit-btn', files)).toBeNull();
  });

  it("testID={'value'} 형태 매칭", () => {
    const files: FileContent[] = [{ uri: 'file:///a.tsx', text: "<Pressable testID={'my-id'} />" }];
    const result = findSourceLine('my-id', files);
    expect(result).not.toBeNull();
    expect(result!.lineIndex).toBe(0);
  });
});
