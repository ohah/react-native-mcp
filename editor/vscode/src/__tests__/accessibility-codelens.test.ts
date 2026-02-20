/**
 * Accessibility CodeLens — shouldProvideLens (TSX/JSX 여부) 테스트
 * Provider 동작은 vscode 런타임 필요로 별도 E2E에서 검증
 */

import { describe, expect, it } from 'bun:test';
import { shouldProvideLens } from '../extension/codelens/accessibility-codelens-logic';

describe('shouldProvideLens', () => {
  it('typescriptreact이면 true', () => {
    expect(shouldProvideLens('typescriptreact')).toBe(true);
  });

  it('javascriptreact이면 true', () => {
    expect(shouldProvideLens('javascriptreact')).toBe(true);
  });

  it('typescript이면 false', () => {
    expect(shouldProvideLens('typescript')).toBe(false);
  });

  it('javascript이면 false', () => {
    expect(shouldProvideLens('javascript')).toBe(false);
  });

  it('json, html 등 다른 언어는 false', () => {
    expect(shouldProvideLens('json')).toBe(false);
    expect(shouldProvideLens('html')).toBe(false);
    expect(shouldProvideLens('markdown')).toBe(false);
  });
});
