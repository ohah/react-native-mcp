/**
 * Babel AST 변환: JSX 요소에 자동 testID 주입
 *
 * DESIGN.md Phase 3 계획에 따른 자동 testID 생성.
 * 커스텀 컴포넌트 내부의 JSX 요소 중 testID가 없으면
 * ComponentName-index-TagName 형식으로 주입한다.
 */

// 번들 후 CJS/ESM interop으로 default가 달라질 수 있음
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';
import * as parser from '@babel/parser';
import * as t from '@babel/types';

const traverse = (traverseModule as { default?: typeof traverseModule }).default ?? traverseModule;
const generate = (generateModule as { default?: typeof generateModule }).default ?? generateModule;

/** 컴포넌트 스코프: 이름 + 해당 스코프 내 JSX 순서 */
interface Scope {
  componentName: string;
  jsxIndex: number;
}

/** traverse 시 상태: 스코프 스택 */
interface VisitorState {
  stack: Scope[];
}

/**
 * 소스 코드를 파싱한 뒤, 컴포넌트 함수 내부의 JSX 요소에
 * testID가 없으면 자동으로 주입한다.
 *
 * @param src - 변환할 소스 문자열
 * @param filename - 파일 경로 (선택)
 * @returns 변환된 code
 */
export async function injectTestIds(src: string, filename?: string): Promise<{ code: string }> {
  const ast = parser.parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    sourceFilename: filename ?? 'component.js',
  });

  const state: VisitorState = { stack: [] };

  traverse(ast, {
    Function: {
      enter(path) {
        let name: string | null =
          t.isFunctionDeclaration(path.node) || t.isFunctionExpression(path.node)
            ? (path.node.id?.name ?? null)
            : null;
        if (
          !name &&
          path.parent &&
          t.isVariableDeclarator(path.parent) &&
          t.isIdentifier(path.parent.id)
        ) {
          name = path.parent.id.name;
        }
        if (!name && t.isIdentifier(path.node.params[0])) {
          name = path.node.params[0].name;
        }
        state.stack.push({ componentName: name ?? 'Anonymous', jsxIndex: 0 });
      },
      exit() {
        state.stack.pop();
      },
    },
    JSXOpeningElement(path) {
      const scope = state.stack[state.stack.length - 1];
      if (scope === undefined) return;
      const el = path.node;
      const testIdAttr = el.attributes.find(
        (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
      ) as t.JSXAttribute | undefined;
      const hasTestId = !!testIdAttr;
      if (!hasTestId) {
        const tagName = getTagName(el.name);
        const value = `${scope.componentName}-${scope.jsxIndex}-${tagName}`;
        el.attributes.push(t.jsxAttribute(t.jsxIdentifier('testID'), t.stringLiteral(value)));
        scope.jsxIndex += 1;
      }
      // testID + onPress 있으면 onPress를 등록 래퍼로 감싸서 MCP triggerPress 가능하게 함
      const onPressAttr = el.attributes.find(
        (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'onPress'
      ) as t.JSXAttribute | undefined;
      const tidAttr =
        testIdAttr ??
        (el.attributes.find(
          (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
        ) as t.JSXAttribute | undefined);
      if (!tidAttr?.value || !onPressAttr?.value) return;
      const testIdValue = getTestIdStringLiteral(tidAttr);
      if (testIdValue == null) return;
      const rawExpr = t.isJSXExpressionContainer(onPressAttr.value)
        ? onPressAttr.value.expression
        : null;
      if (!rawExpr || t.isJSXEmptyExpression(rawExpr)) return;
      const onPressExpr = rawExpr as t.Expression;
      const wrapper = t.callExpression(
        t.functionExpression(
          null,
          [],
          t.blockStatement([
            t.variableDeclaration('var', [t.variableDeclarator(t.identifier('f'), onPressExpr)]),
            t.expressionStatement(
              t.logicalExpression(
                '&&',
                t.memberExpression(
                  t.identifier('__REACT_NATIVE_MCP__'),
                  t.identifier('registerPressHandler')
                ),
                t.callExpression(
                  t.memberExpression(
                    t.identifier('__REACT_NATIVE_MCP__'),
                    t.identifier('registerPressHandler')
                  ),
                  [t.stringLiteral(testIdValue), t.identifier('f')]
                )
              )
            ),
            t.returnStatement(t.identifier('f')),
          ])
        ),
        []
      );
      onPressAttr.value = t.jsxExpressionContainer(wrapper);
    },
  });

  const output = generate(ast, {
    retainLines: false,
    compact: false,
  });

  return { code: output.code };
}

/**
 * testID 속성에서 문자열 리터럴 값 추출 (없으면 null)
 */
function getTestIdStringLiteral(attr: t.JSXAttribute): string | null {
  if (!attr.value) return null;
  if (t.isStringLiteral(attr.value)) return attr.value.value;
  if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression))
    return attr.value.expression.value;
  return null;
}

/**
 * JSX 요소 이름(Identifier, MemberExpression, NamespacedName)을 문자열로 반환
 */
function getTagName(name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName): string {
  if (t.isJSXIdentifier(name)) return name.name;
  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}.${name.name.name}`;
  }
  const parts: string[] = [];
  let cur: t.JSXMemberExpression = name;
  while (true) {
    if (t.isJSXIdentifier(cur.object)) {
      parts.push(cur.object.name);
    } else {
      parts.push(getTagName(cur.object));
    }
    if (t.isJSXIdentifier(cur.property)) {
      parts.push(cur.property.name);
      break;
    }
    cur = cur.property as t.JSXMemberExpression;
  }
  return parts.join('.');
}
