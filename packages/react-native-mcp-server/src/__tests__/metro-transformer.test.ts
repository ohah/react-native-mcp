/**
 * Metro AST transformer 단위 테스트
 *
 * 현재는 Metro에 붙일 변환 로직(transformSource)만 직접 호출해
 * AST 기반 코드 감싸기를 검증한다. 실제 Metro 번들러/runBuild는 사용하지 않음.
 *
 * metro는 devDependency로 넣어 두었음. 나중에 Metro.runBuild()로
 * 통합 테스트 추가 시 사용할 예정.
 */

import { describe, expect, it } from 'bun:test';
import { transformSource } from '../metro/transform-source.ts';

/** REACT_NATIVE_MCP_ENABLED=true 로 transformSource 호출 (변환 기대 시 사용) */
async function transformWithMcpEnabled(src: string) {
  const prev = process.env.REACT_NATIVE_MCP_ENABLED;
  try {
    process.env.REACT_NATIVE_MCP_ENABLED = 'true';
    return await transformSource(src);
  } finally {
    if (prev !== undefined) process.env.REACT_NATIVE_MCP_ENABLED = prev;
    else delete process.env.REACT_NATIVE_MCP_ENABLED;
  }
}

describe('Metro AST transformer', () => {
  it('AppRegistry.registerComponent 호출을 __REACT_NATIVE_MCP__.registerComponent 로 감싼다', async () => {
    const src = `
    import { AppRegistry } from 'react-native';
    import App from './App';
    AppRegistry.registerComponent('App', () => App);
    `;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerComponent');
    expect(code).toContain("'App'");
    expect(code).not.toContain('AppRegistry.registerComponent');
  });

  it('변환 시 진입점 상단에 MCP 런타임 require가 주입된다', async () => {
    const src = `import { AppRegistry } from 'react-native';\nAppRegistry.registerComponent('App', () => App);`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain('@ohah/react-native-mcp-server/runtime');
    expect(code).toMatch(/require\s*\(\s*['"]@ohah\/react-native-mcp-server\/runtime['"]\s*\)/);
  });

  it('변환 후에도 import 문은 유지된다', async () => {
    const src = `import { AppRegistry } from 'react-native';\nAppRegistry.registerComponent('App', () => App);`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain("from 'react-native'");
  });

  it('AppRegistry.registerComponent가 없으면 코드는 그대로 반환된다', async () => {
    const src = `const x = 1;\nconsole.log(x);`;
    const { code } = await transformSource(src);
    expect(code).toContain('const x = 1');
    expect(code).not.toContain('__REACT_NATIVE_MCP__');
  });

  it('변환 결과에 목표한 호출 형태가 정확히 포함된다', async () => {
    const src = `
import { AppRegistry } from 'react-native';
import App from './App';
AppRegistry.registerComponent('App', () => App);
`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain("from 'react-native'");
    expect(code).toContain("from './App'");
    expect(code).toContain("__REACT_NATIVE_MCP__.registerComponent('App', () => App)");
    expect(code).not.toContain('AppRegistry.registerComponent');
  });

  it('변환 시 앱 이름과 컴포넌트 인자가 그대로 유지된다', async () => {
    const src = `import { AppRegistry } from 'react-native';
import App from './App';
AppRegistry.registerComponent('App', () => App);`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain("'App'");
    expect(code).toContain('() => App');
  });

  it('네임드 컴포넌트를 등록하는 경우에도 컴포넌트 참조가 보존된다', async () => {
    const src = `import { AppRegistry } from 'react-native';
function RootComponent() { return null; }
AppRegistry.registerComponent('MyApp', RootComponent);`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerComponent');
    expect(code).toContain("'MyApp'");
    expect(code).toContain('RootComponent');
    expect(code).not.toContain('AppRegistry.registerComponent');
  });

  it('registerComponent 호출이 여러 개면 모두 변환된다', async () => {
    const src = `import { AppRegistry } from 'react-native';
AppRegistry.registerComponent('App', () => App);
AppRegistry.registerComponent('Other', () => Other);`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain("__REACT_NATIVE_MCP__.registerComponent('App', () => App)");
    expect(code).toContain("__REACT_NATIVE_MCP__.registerComponent('Other', () => Other)");
    expect(code).not.toContain('AppRegistry.registerComponent');
  });

  it('AppRegistry의 다른 메서드 호출은 변환하지 않는다', async () => {
    const src = `import { AppRegistry } from 'react-native';
AppRegistry.registerComponent('App', () => App);
AppRegistry.getRunnableApplication();`;
    const { code } = await transformWithMcpEnabled(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerComponent');
    expect(code).toContain('AppRegistry.getRunnableApplication');
  });

  it('registerComponent가 아닌 다른 객체의 registerComponent는 변환하지 않는다', async () => {
    const src = `OtherRegistry.registerComponent('App', () => App);`;
    const { code } = await transformSource(src);
    expect(code).toContain('OtherRegistry.registerComponent');
    expect(code).not.toContain('__REACT_NATIVE_MCP__');
  });

  it('REACT_NATIVE_MCP_ENABLED=true 시 진입점 상단에 global.__REACT_NATIVE_MCP_ENABLED__ 주입', async () => {
    const prev = process.env.REACT_NATIVE_MCP_ENABLED;
    try {
      process.env.REACT_NATIVE_MCP_ENABLED = 'true';
      const src = `import { AppRegistry } from 'react-native';\nAppRegistry.registerComponent('App', () => App);`;
      const { code } = await transformSource(src);
      expect(code).toContain('__REACT_NATIVE_MCP_ENABLED__');
      expect(code).toContain('global.__REACT_NATIVE_MCP_ENABLED__ = true');
      const requireMatch = code.match(
        /require\s*\(\s*['"]@ohah\/react-native-mcp-server\/runtime['"]\s*\)/
      );
      const requireIdx = requireMatch ? requireMatch.index! : -1;
      const flagIdx = code.indexOf('__REACT_NATIVE_MCP_ENABLED__');
      expect(flagIdx).toBeGreaterThanOrEqual(0);
      expect(requireIdx).toBeGreaterThanOrEqual(0);
      expect(flagIdx).toBeLessThan(requireIdx);
    } finally {
      if (prev !== undefined) process.env.REACT_NATIVE_MCP_ENABLED = prev;
      else delete process.env.REACT_NATIVE_MCP_ENABLED;
    }
  });

  it('REACT_NATIVE_MCP_ENABLED 미설정 시 변환하지 않음(코드 그대로)', async () => {
    const prev = process.env.REACT_NATIVE_MCP_ENABLED;
    try {
      delete process.env.REACT_NATIVE_MCP_ENABLED;
      const src = `import { AppRegistry } from 'react-native';\nAppRegistry.registerComponent('App', () => App);`;
      const { code } = await transformSource(src);
      expect(code).not.toContain('__REACT_NATIVE_MCP_ENABLED__');
      expect(code).not.toContain('@ohah/react-native-mcp-server/runtime');
      expect(code).toContain('AppRegistry.registerComponent');
    } finally {
      if (prev !== undefined) process.env.REACT_NATIVE_MCP_ENABLED = prev;
    }
  });
});
