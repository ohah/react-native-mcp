/**
 * Babel 플러그인 통합 테스트
 *
 * babel-plugin-app-registry, babel-plugin-inject-testid를
 * Babel transformSync로 실행해 플러그인 진입점이 올바르게 동작하는지 검증한다.
 */

import { transformSync } from '@babel/core';
import { describe, expect, it } from 'bun:test';
import appRegistryPlugin from '../babel-plugin-app-registry.ts';
import injectTestIdPlugin from '../babel-plugin-inject-testid.ts';

const babelOpts = {
  configFile: false,
  babelrc: false,
  parserOpts: { plugins: ['jsx', 'typescript'] as const },
};

describe('Babel plugin app-registry', () => {
  it('플러그인으로 실행 시 AppRegistry.registerComponent를 치환한다', () => {
    const code = `import { AppRegistry } from 'react-native';
AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [appRegistryPlugin],
      filename: 'entry.js',
    });
    expect(result?.code).toContain('__REACT_NATIVE_MCP__.registerComponent');
    expect(result?.code).toContain('@ohah/react-native-mcp-server/runtime');
    expect(result?.code).not.toContain('AppRegistry.registerComponent');
    // Release 빌드에서도 런타임 연결되도록 global 플래그 주입 확인
    expect(result?.code).toContain('global.__REACT_NATIVE_MCP_ENABLED__ = true');
    // 옵션 없으면 renderHighlight false, style react-mcp
    expect(result?.code).toContain('global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ = false');
    expect(result?.code).toContain(
      'global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT_STYLE__ = "react-mcp"'
    );
  });

  it('renderHighlight: true 옵션 시 RENDER_HIGHLIGHT true + STYLE react-mcp 주입', () => {
    const code = `AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [[appRegistryPlugin, { renderHighlight: true }]],
      filename: 'entry.js',
    });
    expect(result?.code).toContain('global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ = true');
    expect(result?.code).toContain(
      'global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT_STYLE__ = "react-mcp"'
    );
  });

  it('renderHighlight: { enabled: true, style: "react-mcp" } 시 스타일 react-mcp 주입', () => {
    const code = `AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [[appRegistryPlugin, { renderHighlight: { enabled: true, style: 'react-mcp' } }]],
      filename: 'entry.js',
    });
    expect(result?.code).toContain(
      'global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT_STYLE__ = "react-mcp"'
    );
  });

  it('renderHighlight: { enabled: true, style: "react-scan" } 시 스타일 react-scan 주입', () => {
    const code = `AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [[appRegistryPlugin, { renderHighlight: { enabled: true, style: 'react-scan' } }]],
      filename: 'entry.js',
    });
    expect(result?.code).toContain('global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ = true');
    expect(result?.code).toContain('"react-scan"');
  });

  it('renderHighlight: { enabled: false } 시 RENDER_HIGHLIGHT false 주입', () => {
    const code = `AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [[appRegistryPlugin, { renderHighlight: { enabled: false, style: 'react-mcp' } }]],
      filename: 'entry.js',
    });
    expect(result?.code).toContain('global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__ = false');
    expect(result?.code).toContain('"react-mcp"');
  });

  it('renderHighlight 객체에 style 없으면 STYLE react-mcp', () => {
    const code = `AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [[appRegistryPlugin, { renderHighlight: { enabled: true } }]],
      filename: 'entry.js',
    });
    expect(result?.code).toContain(
      'global.__REACT_NATIVE_MCP_RENDER_HIGHLIGHT_STYLE__ = "react-mcp"'
    );
  });

  it('플러그인으로 실행 시 node_modules 경로면 변환하지 않는다', () => {
    const code = `AppRegistry.registerComponent('App', () => App);`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [appRegistryPlugin],
      filename: '/some/node_modules/foo/entry.js',
    });
    expect(result?.code).toContain('AppRegistry.registerComponent');
    expect(result?.code).not.toContain('__REACT_NATIVE_MCP__');
  });
});

describe('Babel plugin inject-testid', () => {
  it('플러그인으로 실행 시 JSX에 testID가 주입된다', () => {
    const code = `
function MyScreen() {
  return (
    <View>
      <Text>Hi</Text>
    </View>
  );
}
`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [injectTestIdPlugin],
      filename: 'Screen.js',
    });
    expect(result?.code).toContain('testID="MyScreen-0-View"');
    expect(result?.code).toContain('testID="MyScreen-1-Text"');
  });

  it('플러그인으로 실행 시 node_modules 경로면 변환하지 않는다', () => {
    const code = `function X() { return <View><Text>a</Text></View>; }`;
    const result = transformSync(code, {
      ...babelOpts,
      plugins: [injectTestIdPlugin],
      filename: '/tmp/node_modules/pkg/index.js',
    });
    expect(result?.code).not.toContain('testID="');
  });
});
