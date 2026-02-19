/**
 * Babel 프리셋 옵션 테스트
 *
 * babel-preset.cjs가 옵션에 따라 올바른 플러그인 배열을 반환하는지 검증한다.
 */

import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, afterEach } from 'bun:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const presetPath = path.resolve(__dirname, '../../babel-preset.cjs');
const preset = require(presetPath) as (
  api: unknown,
  options?: Record<string, unknown>
) => { plugins: unknown[] };

describe('Babel preset', () => {
  const origNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
  });

  it('옵션 없으면 appRegistry + injectTestId 플러그인 반환', () => {
    process.env.NODE_ENV = 'development';
    const result = preset(null, undefined);
    expect(result.plugins).toBeDefined();
    expect(Array.isArray(result.plugins)).toBe(true);
    expect(result.plugins.length).toBe(2);
    expect(Array.isArray(result.plugins[0])).toBe(true);
    expect((result.plugins[0] as [unknown, unknown])[0]).toBeTypeOf('function');
    expect(
      (result.plugins[0] as [unknown, { renderHighlight: { enabled: boolean; style: string } }])[1]
    ).toEqual({
      renderHighlight: { enabled: false, style: 'react-mcp' },
    });
    expect(typeof result.plugins[1]).toBe('function');
  });

  it('renderHighlight: true 옵션 시 enabled true + style react-mcp 전달', () => {
    process.env.NODE_ENV = 'development';
    const result = preset(null, { renderHighlight: true });
    expect(result.plugins.length).toBe(2);
    expect(
      (result.plugins[0] as [unknown, { renderHighlight: { enabled: boolean; style: string } }])[1]
    ).toEqual({
      renderHighlight: { enabled: true, style: 'react-mcp' },
    });
  });

  it('renderHighlight: { style: "react-scan" } 시 해당 스타일 전달', () => {
    process.env.NODE_ENV = 'development';
    const result = preset(null, { renderHighlight: { style: 'react-scan' } });
    expect(
      (result.plugins[0] as [unknown, { renderHighlight: { enabled: boolean; style: string } }])[1]
    ).toEqual({
      renderHighlight: { enabled: true, style: 'react-scan' },
    });
  });

  it('renderHighlight: { style: "react-mcp" } 시 react-mcp 스타일 전달', () => {
    process.env.NODE_ENV = 'development';
    const result = preset(null, { renderHighlight: { style: 'react-mcp' } });
    expect(
      (result.plugins[0] as [unknown, { renderHighlight: { enabled: boolean; style: string } }])[1]
    ).toEqual({
      renderHighlight: { enabled: true, style: 'react-mcp' },
    });
  });

  it('renderHighlight: false 이면 enabled false + style react-mcp', () => {
    process.env.NODE_ENV = 'development';
    const result = preset(null, { renderHighlight: false });
    expect(
      (result.plugins[0] as [unknown, { renderHighlight: { enabled: boolean; style: string } }])[1]
    ).toEqual({
      renderHighlight: { enabled: false, style: 'react-mcp' },
    });
  });

  it('renderHighlight: 잘못된 style이면 enabled false로 정규화', () => {
    process.env.NODE_ENV = 'development';
    const result = preset(null, { renderHighlight: { style: 'unknown' as string } });
    expect(
      (result.plugins[0] as [unknown, { renderHighlight: { enabled: boolean; style: string } }])[1]
    ).toEqual({
      renderHighlight: { enabled: false, style: 'react-mcp' },
    });
  });

  it('NODE_ENV=production 이고 REACT_NATIVE_MCP_ENABLED 없으면 빈 플러그인', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.REACT_NATIVE_MCP_ENABLED;
    const result = preset(null, {});
    expect(result.plugins).toEqual([]);
  });

  it('NODE_ENV=production 이고 REACT_NATIVE_MCP_ENABLED=true 이면 플러그인 반환', () => {
    process.env.NODE_ENV = 'production';
    process.env.REACT_NATIVE_MCP_ENABLED = 'true';
    const result = preset(null, {});
    expect(result.plugins.length).toBe(2);
    process.env.REACT_NATIVE_MCP_ENABLED = '';
  });
});
