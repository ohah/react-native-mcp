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

  // INJECT_PRESS_HANDLER=false: registerPressHandler 주입이 비활성화됨
  // Fiber memoizedProps.onPress()로 직접 호출 가능하므로 Babel 래핑 불필요
  // 재활성화: inject-testid.ts에서 INJECT_PRESS_HANDLER = true로 변경
  it('INJECT_PRESS_HANDLER=false: onPress가 registerPressHandler로 래핑되지 않는다', async () => {
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
    expect(code).not.toContain('__REACT_NATIVE_MCP__.registerPressHandler');
    expect(code).toContain('demo-app-counter-button');
    expect(code).toContain('onPress=');
  });

  // INJECT_SCROLL_REF=false: ScrollView ref 주입이 비활성화됨
  // Fiber stateNode.scrollTo()로 직접 접근 가능하므로 Babel ref 주입 불필요
  // 재활성화: inject-testid.ts에서 INJECT_SCROLL_REF = true로 변경
  it('INJECT_SCROLL_REF=false: ScrollView에 registerScrollRef가 주입되지 않는다', async () => {
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
    expect(code).not.toContain('registerScrollRef');
    expect(code).not.toContain('unregisterScrollRef');
    expect(code).toContain('demo-app-scroll-view');
  });

  it('INJECT_PRESS_HANDLER=false: 동적 testID(TemplateLiteral)도 registerPressHandler 래핑 안 됨', async () => {
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
    expect(code).not.toContain('__REACT_NATIVE_MCP__.registerPressHandler');
    expect(code).toContain('item.id');
    expect(code).toContain('onPress=');
  });

  it('INJECT_PRESS_HANDLER=false: 동적 testID(변수 참조)도 registerPressHandler 래핑 안 됨', async () => {
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
    expect(code).not.toContain('__REACT_NATIVE_MCP__.registerPressHandler');
    expect(code).toContain('onPress=');
  });

  it('key prop이 있으면 testID에 key가 포함된 동적 testID가 생성된다', async () => {
    const src = `
function Numpad({ onPress }) {
  return [1,2,3].map((num) => (
    <Pressable key={num} onPress={() => onPress(num)}>
      <Text>{num}</Text>
    </Pressable>
  ));
}
`;
    const { code } = await injectTestIds(src);
    // key가 있으면 template literal: `num-0-Pressable-${num}`
    expect(code).toContain('`num-0-Pressable-${num}`');
    // 자식 Text에는 key가 없으므로 정적 testID
    expect(code).toContain('testID="num-1-Text"');
  });

  it('key prop이 문자열이면 동적 testID에 문자열 key가 포함된다', async () => {
    const src = `
function List() {
  return <View key="header"><Text>hi</Text></View>;
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('`List-0-View-${"header"}`');
  });

  it('key prop이 없으면 기존 정적 testID가 유지된다', async () => {
    const src = `
function Card() {
  return <View><Text>hi</Text></View>;
}
`;
    const { code } = await injectTestIds(src);
    expect(code).toContain('testID="Card-0-View"');
    expect(code).toContain('testID="Card-1-Text"');
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

  it('INJECT_SCROLL_REF=false: ScrollView에 ref가 있어도 합성되지 않는다', async () => {
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
    expect(code).not.toContain('registerScrollRef');
    expect(code).not.toContain('unregisterScrollRef');
    expect(code).toContain('my-scroll');
    // 원본 ref가 그대로 유지됨
    expect(code).toContain('ref={scrollRef}');
  });
});
