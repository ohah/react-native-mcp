/**
 * Babel testID 자동 주입 단위 테스트
 *
 * DESIGN.md Phase 3: 커스텀 컴포넌트 내 JSX 요소에
 * testID가 없으면 ComponentName-index-TagName 형식으로 주입한다.
 */

import { describe, expect, it } from 'bun:test';
import { injectTestIds } from '../babel/inject-testid.ts';

describe('Babel testID 자동 주입', () => {
  it('커스텀 컴포넌트 내부의 네이티브 컴포넌트에 testID가 주입된다', async () => {
    const src = `
function MyButton({ title }) {
  return (
    <TouchableOpacity>
      <Text>{title}</Text>
    </TouchableOpacity>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('testID="MyButton-0-TouchableOpacity"');
    expect(code).toContain('testID="MyButton-1-Text"');
  });

  it('이미 testID가 있으면 덮어쓰지 않는다', async () => {
    const src = `
function Screen() {
  return (
    <View testID="custom-root">
      <Text>Hi</Text>
    </View>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('testID="custom-root"');
    expect(code).toContain('testID="Screen-0-Text"');
    expect(code).not.toContain('Screen-0-View');
  });

  it('형식은 ComponentName-index-TagName 이다', async () => {
    const src = `
function Item() {
  return <View><Text>x</Text></View>;
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toMatch(/testID="Item-\d+-View"/);
    expect(code).toMatch(/testID="Item-\d+-Text"/);
  });

  it('화살표 함수 컴포넌트에도 주입된다', async () => {
    const src = `
const Card = () => (
  <View>
    <Text>Card</Text>
  </View>
);
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('testID="Card-0-View"');
    expect(code).toContain('testID="Card-1-Text"');
  });

  it('중첩된 컴포넌트는 각자 스코프로 주입된다', async () => {
    const src = `
function Outer() {
  return (
    <View>
      <Inner />
    </View>
  );
}
function Inner() {
  return <Text>inner</Text>;
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('testID="Outer-0-View"');
    expect(code).toContain('testID="Inner-0-Text"');
  });

  it('JSX가 없는 코드는 testID가 주입되지 않는다', async () => {
    const src = `const x = 1; console.log(x);`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('const x = 1');
    expect(code).toContain('console.log(x)');
    expect(code).not.toContain('testID=');
  });

  it('함수에 JSX가 없으면 testID가 주입되지 않는다', async () => {
    const src = `function Helper() { return 1; }`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('return 1');
    expect(code).not.toContain('testID=');
  });

  it('함수 스코프 밖의 JSX는 주입하지 않는다', async () => {
    const src = `const el = <View><Text>hi</Text></View>;`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('<View>');
    expect(code).not.toContain('testID=');
  });

  it('MemberExpression 태그(View.Text 등)에도 주입한다', async () => {
    const src = `
function Label() {
  return <View.Text>Hello</View.Text>;
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toMatch(/testID="Label-0-View\.Text"/);
  });

  it('이름 없는 화살표 함수는 Anonymous로 주입한다', async () => {
    const src = `
export default () => (
  <View><Text>x</Text></View>
);
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('testID="Anonymous-0-View"');
    expect(code).toContain('testID="Anonymous-1-Text"');
  });
});
