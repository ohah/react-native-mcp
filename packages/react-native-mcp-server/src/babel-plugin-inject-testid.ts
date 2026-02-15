/**
 * Babel 플러그인: JSX 자동 testID 주입, displayName, ScrollView ref, onPress 래퍼
 *
 * Metro transformer 대신 babel.config.js plugins에 넣어 사용.
 */

import type * as t from '@babel/types';

interface BabelApi {
  types: typeof t;
}

interface Scope {
  componentName: string;
  jsxIndex: number;
}

interface PluginState {
  stack: Scope[];
}

function getTestIdStringLiteral(t: BabelApi['types'], attr: t.JSXAttribute): string | null {
  if (!attr.value) return null;
  if (t.isStringLiteral(attr.value)) return attr.value.value;
  if (t.isJSXExpressionContainer(attr.value) && t.isStringLiteral(attr.value.expression))
    return attr.value.expression.value;
  return null;
}

function getTestIdExpression(t: BabelApi['types'], attr: t.JSXAttribute): t.Expression | null {
  if (!attr.value) return null;
  if (t.isStringLiteral(attr.value)) return attr.value;
  if (t.isJSXExpressionContainer(attr.value) && !t.isJSXEmptyExpression(attr.value.expression))
    return attr.value.expression as t.Expression;
  return null;
}

function getTagName(
  t: BabelApi['types'],
  name: t.JSXIdentifier | t.JSXMemberExpression | t.JSXNamespacedName
): string {
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
      parts.push(getTagName(t, cur.object));
    }
    if (t.isJSXIdentifier(cur.property)) {
      parts.push(cur.property.name);
      break;
    }
    cur = cur.property as t.JSXMemberExpression;
  }
  return parts.join('.');
}

/**
 * Fiber 직접 접근으로 대체 가능 — 재활성화 시 true로 변경
 * - INJECT_PRESS_HANDLER: onPress를 registerPressHandler로 래핑. Fiber memoizedProps.onPress()로 직접 호출 가능.
 * - INJECT_SCROLL_REF: ScrollView/FlatList에 registerScrollRef ref 주입. Fiber stateNode.scrollTo()로 직접 접근 가능.
 */
const INJECT_PRESS_HANDLER = false;
const INJECT_SCROLL_REF = false;

export default function (babel: BabelApi): { name: string; visitor: Record<string, unknown> } {
  const t = babel.types;
  return {
    name: 'react-native-mcp-inject-testid',
    visitor: {
      Program: {
        enter(_path: unknown, state: PluginState) {
          state.stack = [];
        },
      },
      Function: {
        enter(
          path: {
            node: t.Function;
            parent: t.Node | null;
            parentPath?: { parent: t.Node | null };
            insertAfter: (n: t.Node) => void;
          },
          state: PluginState
        ) {
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
        exit(
          path: {
            node: t.Function;
            parent: t.Node | null;
            parentPath?: { parent: t.Node | null; parentPath?: { parent: t.Node | null } };
            insertAfter: (n: t.Node) => void;
          },
          state: PluginState
        ) {
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
                (t.isExportDefaultDeclaration(path.parent) ||
                  t.isExportNamedDeclaration(path.parent))
                  ? path.parentPath
                  : path;
              target.insertAfter(stmt);
            } else if (path.parentPath && t.isVariableDeclarator(path.parent)) {
              let target = path.parentPath.parentPath;
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
      JSXOpeningElement(
        path: {
          node: t.JSXOpeningElement;
          hub?: { file?: { opts?: { filename?: string } } };
        },
        state: PluginState
      ) {
        const filename = path.hub?.file?.opts?.filename ?? '';
        if (filename.includes('node_modules')) return;
        const scope = state.stack[state.stack.length - 1];
        if (scope === undefined) return;
        const el = path.node;
        const testIdAttr = el.attributes.find(
          (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
        ) as t.JSXAttribute | undefined;
        const hasTestId = !!testIdAttr;
        if (!hasTestId) {
          const tagName = getTagName(t, el.name);
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
            el.attributes.push(
              t.jsxAttribute(t.jsxIdentifier('testID'), t.stringLiteral(baseValue))
            );
          }
          scope.jsxIndex += 1;
        }
        const tagName = getTagName(t, el.name);
        if (tagName === 'WebView') {
          const webViewTidAttr =
            testIdAttr ??
            (el.attributes.find(
              (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
            ) as t.JSXAttribute | undefined);
          const webViewTestIdValue = webViewTidAttr
            ? getTestIdStringLiteral(t, webViewTidAttr)
            : null;
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
                  t.binaryExpression(
                    '!=',
                    t.cloneNode(userRefExpr as t.Expression),
                    t.nullLiteral()
                  ),
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
            // onMessage: webview_evaluate_script 결과 수신. 사용자 onMessage 있으면 createWebViewOnMessage로 감쌈.
            const onMessageAttr = el.attributes.find(
              (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'onMessage'
            ) as t.JSXAttribute | undefined;
            const userOnMessageExpr =
              onMessageAttr?.value && t.isJSXExpressionContainer(onMessageAttr.value)
                ? (onMessageAttr.value as { expression: t.Expression }).expression
                : null;
            const hasUserOnMessage =
              userOnMessageExpr != null && !t.isJSXEmptyExpression(userOnMessageExpr as t.Node);
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
        if (INJECT_SCROLL_REF && (tagName === 'ScrollView' || tagName === 'FlatList')) {
          const scrollTidAttr =
            testIdAttr ??
            (el.attributes.find(
              (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
            ) as t.JSXAttribute | undefined);
          const scrollTestIdValue = scrollTidAttr ? getTestIdStringLiteral(t, scrollTidAttr) : null;
          if (scrollTestIdValue != null) {
            const refAttr = el.attributes.find(
              (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'ref'
            ) as t.JSXAttribute | undefined;
            const mcpRegister = t.expressionStatement(
              t.logicalExpression(
                '&&',
                t.optionalMemberExpression(
                  t.identifier('__REACT_NATIVE_MCP__'),
                  t.identifier('registerScrollRef'),
                  false,
                  true
                ),
                t.callExpression(
                  t.memberExpression(
                    t.optionalMemberExpression(
                      t.identifier('__REACT_NATIVE_MCP__'),
                      t.identifier('registerScrollRef'),
                      false,
                      true
                    ),
                    t.identifier('call'),
                    false
                  ),
                  [
                    t.identifier('__REACT_NATIVE_MCP__'),
                    t.stringLiteral(scrollTestIdValue),
                    t.identifier('r'),
                  ]
                )
              )
            );
            const mcpUnregister = t.expressionStatement(
              t.logicalExpression(
                '&&',
                t.optionalMemberExpression(
                  t.identifier('__REACT_NATIVE_MCP__'),
                  t.identifier('unregisterScrollRef'),
                  false,
                  true
                ),
                t.callExpression(
                  t.memberExpression(
                    t.optionalMemberExpression(
                      t.identifier('__REACT_NATIVE_MCP__'),
                      t.identifier('unregisterScrollRef'),
                      false,
                      true
                    ),
                    t.identifier('call'),
                    false
                  ),
                  [t.identifier('__REACT_NATIVE_MCP__'), t.stringLiteral(scrollTestIdValue)]
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
                  t.binaryExpression(
                    '!=',
                    t.cloneNode(userRefExpr as t.Expression),
                    t.nullLiteral()
                  ),
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
          }
        }
        // → Fiber memoizedProps.onPress()로 직접 호출 가능하므로 비활성화됨
        if (!INJECT_PRESS_HANDLER) return;
        const onPressAttr = el.attributes.find(
          (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'onPress'
        ) as t.JSXAttribute | undefined;
        const tidAttr =
          testIdAttr ??
          (el.attributes.find(
            (a) => t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === 'testID'
          ) as t.JSXAttribute | undefined);
        if (!tidAttr?.value || !onPressAttr?.value) return;
        const testIdExpr = getTestIdExpression(t, tidAttr);
        if (testIdExpr == null) return;
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
                    [t.cloneNode(testIdExpr), t.identifier('f')]
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
    },
  };
}
