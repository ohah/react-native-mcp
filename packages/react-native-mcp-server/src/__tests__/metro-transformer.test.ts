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

describe('Metro AST transformer', () => {
  it('AppRegistry.registerComponent 호출을 __REACT_NATIVE_MCP__.registerComponent 로 감싼다', async () => {
    const src = `
    import { AppRegistry } from 'react-native';
    import App from './App';
    AppRegistry.registerComponent('App', () => App);
    `;
    const { code } = await transformSource(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerComponent');
    expect(code).toContain("'App'");
    expect(code).not.toContain('AppRegistry.registerComponent');
  });

  it('변환 후에도 import 문은 유지된다', async () => {
    const src = `import { AppRegistry } from 'react-native';\nAppRegistry.registerComponent('App', () => App);`;
    const { code } = await transformSource(src);
    expect(code).toContain("from 'react-native'");
  });

  it('AppRegistry.registerComponent가 없으면 코드는 그대로 반환된다', async () => {
    const src = `const x = 1;\nconsole.log(x);`;
    const { code } = await transformSource(src);
    expect(code).toContain('const x = 1');
    expect(code).not.toContain('__REACT_NATIVE_MCP__');
  });
});
