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

  it('testID와 onPress가 있으면 onPress를 registerPressHandler 래퍼로 감싼다', async () => {
    const src = `
function App() {
  const [n, setN] = useState(0);
  return (
    <Pressable testID="demo-app-counter-button" onPress={() => setN((c) => c + 1)}>
      <Text>Count: {n}</Text>
    </Pressable>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerPressHandler');
    expect(code).toContain('demo-app-counter-button');
    expect(code).toContain('onPress=');
  });

  it('ScrollView에 testID만 있으면 ref만 주입된다 (합성 아님)', async () => {
    const src = `
function Screen() {
  return (
    <ScrollView testID="demo-app-scroll-view">
      <Text>content</Text>
    </ScrollView>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('registerScrollRef');
    expect(code).toContain('unregisterScrollRef');
    expect(code).toContain('demo-app-scroll-view');
    // 사용자 ref 합성 없음: typeof xxx === 'function' / .current 할당이 없어야 함 (우리 콜백만 있음)
    const refInjected = /ref=\{[^}]*registerScrollRef[^}]*\}/s.test(code) || code.includes('ref={');
    expect(refInjected).toBe(true);
    // 합성 시 나오는 패턴: typeof ... === 'function' 이 없음 (ref 없으면 그 블록 자체가 없음)
    const hasUserRefBranch = code.includes('typeof') && code.includes("'function'");
    expect(hasUserRefBranch).toBe(false);
  });

  it('동적 testID(TemplateLiteral)와 onPress가 있으면 registerPressHandler 래퍼로 감싼다', async () => {
    const src = `
function ListItem({ item, onPress }) {
  return (
    <Pressable testID={\`btn-\${item.id}\`} onPress={onPress}>
      <Text>{item.title}</Text>
    </Pressable>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerPressHandler');
    expect(code).toContain('item.id');
    expect(code).toContain('onPress=');
  });

  it('동적 testID(변수 참조)와 onPress가 있으면 registerPressHandler 래퍼로 감싼다', async () => {
    const src = `
function MyBtn({ tid, onTap }) {
  return (
    <Pressable testID={tid} onPress={onTap}>
      <Text>tap</Text>
    </Pressable>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('__REACT_NATIVE_MCP__.registerPressHandler');
    expect(code).toContain('onPress=');
  });

  it('WebView에 testID만 있으면 ref가 주입된다 (합성 아님)', async () => {
    const src = `
function Screen() {
  return (
    <WebView testID="my-webview" source={{ uri: 'https://example.com' }} />
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('registerWebView');
    expect(code).toContain('unregisterWebView');
    expect(code).toContain('my-webview');
    const refInjected = /ref=\{[^}]*registerWebView[^}]*\}/s.test(code) || code.includes('ref={');
    expect(refInjected).toBe(true);
    const hasUserRefBranch = code.includes('typeof') && code.includes("'function'");
    expect(hasUserRefBranch).toBe(false);
  });

  it('WebView에 testID와 ref가 있으면 ref가 합성된다', async () => {
    const src = `
function Screen() {
  const webViewRef = useRef(null);
  return (
    <WebView testID="my-webview" ref={webViewRef} source={{ uri: 'https://example.com' }} />
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('registerWebView');
    expect(code).toContain('unregisterWebView');
    expect(code).toContain('my-webview');
    expect(code).toContain('typeof');
    expect(code).toMatch(/"function"|'function'/);
    expect(code).toContain('webViewRef');
    expect(code).toContain('.current');
  });

  it('ScrollView에 testID와 ref가 있으면 ref가 합성된다', async () => {
    const src = `
function Screen() {
  const scrollRef = useRef(null);
  return (
    <ScrollView testID="my-scroll" ref={scrollRef}>
      <Text>content</Text>
    </ScrollView>
  );
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('registerScrollRef');
    expect(code).toContain('unregisterScrollRef');
    expect(code).toContain('my-scroll');
    // 사용자 ref 합성: typeof ... === "function" 분기와 .current 할당이 있어야 함
    expect(code).toContain('typeof');
    expect(code).toMatch(/"function"|'function'/);
    expect(code).toContain('scrollRef');
    expect(code).toContain('.current');
  });
});
