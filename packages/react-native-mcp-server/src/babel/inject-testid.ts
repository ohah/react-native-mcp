/**
 * Babel AST 변환: JSX 요소에 자동 testID 주입 + displayName 보존
 *
 * DESIGN.md Phase 3 계획에 따른 자동 testID 생성.
 * 커스텀 컴포넌트 내부의 JSX 요소 중 testID가 없으면
 * ComponentName-index-TagName 형식으로 주입한다.
 *
 * PascalCase 함수 컴포넌트에 displayName을 자동 주입해
 * release 빌드에서도 Fiber 트리에서 컴포넌트 이름을 보존한다.
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
      exit(path) {
        const scope = state.stack[state.stack.length - 1];
        if (
          scope &&
          scope.jsxIndex > 0 &&
          scope.componentName !== 'Anonymous' &&
          /^[A-Z]/.test(scope.componentName)
        ) {
          const stmt = t.expressionStatement(
            t.assignmentExpression(
              '=',
              t.memberExpression(t.identifier(scope.componentName), t.identifier('displayName')),
              t.stringLiteral(scope.componentName)
            )
          );
          if (t.isFunctionDeclaration(path.node)) {
            const target =
              path.parentPath &&
              (t.isExportDefaultDeclaration(path.parent) || t.isExportNamedDeclaration(path.parent))
                ? path.parentPath
                : path;
            target.insertAfter(stmt);
          } else if (path.parentPath && t.isVariableDeclarator(path.parent)) {
            let target = path.parentPath.parentPath; // VariableDeclaration
            if (
              target?.parentPath &&
              (t.isExportDefaultDeclaration(target.parent) ||
                t.isExportNamedDeclaration(target.parent))
            ) {
              target = target.parentPath;
            }
            target?.insertAfter(stmt);
          }
        }
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
        const baseValue = `${scope.componentName}-${scope.jsxIndex}-${tagName}`;

        // key prop이 있으면 동적 testID 생성: `Base-${key}`
        const keyAttr = el.attributes.find(
          (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'key'
        ) as t.JSXAttribute | undefined;

        let keyExpr: t.Expression | null = null;
        if (keyAttr?.value) {
          if (t.isStringLiteral(keyAttr.value)) {
            keyExpr = keyAttr.value;
          } else if (
            t.isJSXExpressionContainer(keyAttr.value) &&
            !t.isJSXEmptyExpression(keyAttr.value.expression)
          ) {
            keyExpr = keyAttr.value.expression as t.Expression;
          }
        }

        if (keyExpr) {
          const tpl = t.templateLiteral(
            [
              t.templateElement({ raw: baseValue + '-', cooked: baseValue + '-' }, false),
              t.templateElement({ raw: '', cooked: '' }, true),
            ],
            [t.cloneNode(keyExpr)]
          );
          el.attributes.push(
            t.jsxAttribute(t.jsxIdentifier('testID'), t.jsxExpressionContainer(tpl))
          );
        } else {
          el.attributes.push(t.jsxAttribute(t.jsxIdentifier('testID'), t.stringLiteral(baseValue)));
        }
        scope.jsxIndex += 1;
      }
      // ScrollView/FlatList는 위에서 testID가 없으면 이미 자동 주입됨 → 모두 ref 주입/합성 (앱 내부 MCP.scrollTo 호출용. MCP 클라이언트용 scroll 도구는 없으며, 스크롤은 swipe 도구 사용)
      const tagName = getTagName(el.name);
      if (tagName === 'WebView') {
        const webViewTidAttr =
          testIdAttr ??
          (el.attributes.find(
            (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
          ) as t.JSXAttribute | undefined);
        const webViewTestIdValue = webViewTidAttr ? getTestIdStringLiteral(webViewTidAttr) : null;
        if (webViewTestIdValue != null) {
          const refAttr = el.attributes.find(
            (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'ref'
          ) as t.JSXAttribute | undefined;
          const mcpRegister = t.expressionStatement(
            t.logicalExpression(
              '&&',
              t.optionalMemberExpression(
                t.identifier('__REACT_NATIVE_MCP__'),
                t.identifier('registerWebView'),
                false,
                true
              ),
              t.callExpression(
                t.memberExpression(
                  t.optionalMemberExpression(
                    t.identifier('__REACT_NATIVE_MCP__'),
                    t.identifier('registerWebView'),
                    false,
                    true
                  ),
                  t.identifier('call'),
                  false
                ),
                [
                  t.identifier('__REACT_NATIVE_MCP__'),
                  t.identifier('r'),
                  t.stringLiteral(webViewTestIdValue),
                ]
              )
            )
          );
          const mcpUnregister = t.expressionStatement(
            t.logicalExpression(
              '&&',
              t.optionalMemberExpression(
                t.identifier('__REACT_NATIVE_MCP__'),
                t.identifier('unregisterWebView'),
                false,
                true
              ),
              t.callExpression(
                t.memberExpression(
                  t.optionalMemberExpression(
                    t.identifier('__REACT_NATIVE_MCP__'),
                    t.identifier('unregisterWebView'),
                    false,
                    true
                  ),
                  t.identifier('call'),
                  false
                ),
                [t.identifier('__REACT_NATIVE_MCP__'), t.stringLiteral(webViewTestIdValue)]
              )
            )
          );
          const bodyStatements: t.Statement[] = [
            t.ifStatement(t.identifier('r'), mcpRegister, mcpUnregister),
          ];
          const userRefExpr =
            refAttr?.value && t.isJSXExpressionContainer(refAttr.value)
              ? refAttr.value.expression
              : null;
          const hasUserRef = userRefExpr != null && !t.isJSXEmptyExpression(userRefExpr);
          if (hasUserRef) {
            bodyStatements.push(
              t.ifStatement(
                t.binaryExpression('!=', t.cloneNode(userRefExpr as t.Expression), t.nullLiteral()),
                t.blockStatement([
                  t.ifStatement(
                    t.binaryExpression(
                      '===',
                      t.unaryExpression('typeof', t.cloneNode(userRefExpr as t.Expression)),
                      t.stringLiteral('function')
                    ),
                    t.expressionStatement(
                      t.callExpression(t.cloneNode(userRefExpr as t.Expression), [
                        t.identifier('r'),
                      ])
                    ),
                    t.expressionStatement(
                      t.assignmentExpression(
                        '=',
                        t.memberExpression(
                          t.cloneNode(userRefExpr as t.Expression),
                          t.identifier('current')
                        ),
                        t.identifier('r')
                      )
                    )
                  ),
                ])
              )
            );
          }
          const composedRef = t.arrowFunctionExpression(
            [t.identifier('r')],
            t.blockStatement(bodyStatements)
          );
          if (refAttr) {
            refAttr.value = t.jsxExpressionContainer(composedRef);
          } else {
            el.attributes.push(
              t.jsxAttribute(t.jsxIdentifier('ref'), t.jsxExpressionContainer(composedRef))
            );
          }
          // onMessage 자동 주입: webview_evaluate_script 결과 수신. 사용자 onMessage 있으면 createWebViewOnMessage로 감쌈.
          const onMessageAttr = el.attributes.find(
            (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'onMessage'
          ) as t.JSXAttribute | undefined;
          const userOnMessageExpr =
            onMessageAttr?.value && t.isJSXExpressionContainer(onMessageAttr.value)
              ? onMessageAttr.value.expression
              : null;
          const hasUserOnMessage =
            userOnMessageExpr != null && !t.isJSXEmptyExpression(userOnMessageExpr);
          const mcpOnMessage = hasUserOnMessage
            ? t.callExpression(
                t.memberExpression(
                  t.identifier('__REACT_NATIVE_MCP__'),
                  t.identifier('createWebViewOnMessage'),
                  false
                ),
                [userOnMessageExpr as t.Expression]
              )
            : t.arrowFunctionExpression(
                [t.identifier('e')],
                t.callExpression(
                  t.memberExpression(
                    t.identifier('__REACT_NATIVE_MCP__'),
                    t.identifier('handleWebViewMessage'),
                    false
                  ),
                  [
                    t.memberExpression(
                      t.memberExpression(t.identifier('e'), t.identifier('nativeEvent')),
                      t.identifier('data')
                    ),
                  ]
                )
              );
          if (onMessageAttr) {
            onMessageAttr.value = t.jsxExpressionContainer(mcpOnMessage);
          } else {
            el.attributes.push(
              t.jsxAttribute(t.jsxIdentifier('onMessage'), t.jsxExpressionContainer(mcpOnMessage))
            );
          }
        }
      }
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
