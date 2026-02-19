/**
 * Babel 플러그인: AppRegistry.registerComponent → __REACT_NATIVE_MCP__.registerComponent 치환
 * + 진입점 상단에 MCP 런타임 require 주입
 *
 * Metro transformer 대신 babel.config.js plugins에 넣어 사용.
 */

import type { NodePath } from '@babel/traverse';
import type * as t from '@babel/types';

const MCP_RUNTIME_ID = '__REACT_NATIVE_MCP__';
const RUNTIME_MODULE_ID = '@ohah/react-native-mcp-server/runtime';

interface BabelApi {
  types: typeof t;
}

interface PluginOptions {
  renderHighlight?: boolean | { enabled?: boolean; style?: 'react-scan' | 'react-mcp' };
}

interface PluginState {
  runtimeInjected: boolean;
  opts?: PluginOptions;
}

export default function (babel: BabelApi): { name: string; visitor: Record<string, unknown> } {
  const t = babel.types;
  return {
    name: 'react-native-mcp-app-registry',
    visitor: {
      Program: {
        enter(_path: unknown, state: PluginState) {
          state.runtimeInjected = false;
        },
      },
      CallExpression(path: NodePath<t.CallExpression>, state: PluginState) {
        const node = path.node;
        const filename =
          (path.hub as { file?: { opts?: { filename?: string } } } | undefined)?.file?.opts
            ?.filename ?? '';
        if (filename.includes('node_modules')) return;
        if (!t.isCallExpression(node)) return;
        if (!t.isMemberExpression(node.callee)) return;
        const { object, property } = node.callee;
        if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;
        if (object.name !== 'AppRegistry' || property.name !== 'registerComponent') return;

        if (!state.runtimeInjected) {
          const programPath = path.findParent((p) => p.isProgram?.()) as
            | NodePath<t.Program>
            | undefined;
          if (programPath?.node?.body) {
            const rh = state.opts?.renderHighlight;
            const renderHighlightEnabled =
              rh === true || (typeof rh === 'object' && rh !== null && rh.enabled === true);
            const renderHighlightStyle =
              rh === true
                ? 'react-mcp'
                : typeof rh === 'object' &&
                    rh !== null &&
                    (rh.style === 'react-scan' || rh.style === 'react-mcp')
                  ? rh.style
                  : 'react-mcp';
            // 1) MCP 런타임 require
            programPath.node.body.unshift(
              t.expressionStatement(
                t.callExpression(t.identifier('require'), [t.stringLiteral(RUNTIME_MODULE_ID)])
              )
            );
            // 2) 렌더 하이라이트 스타일 (react-mcp 기본)
            programPath.node.body.unshift(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier('global'),
                    t.identifier('__REACT_NATIVE_MCP_RENDER_HIGHLIGHT_STYLE__')
                  ),
                  t.stringLiteral(renderHighlightStyle)
                )
              )
            );
            // 3) 렌더 하이라이트 기본 켜기 여부
            programPath.node.body.unshift(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier('global'),
                    t.identifier('__REACT_NATIVE_MCP_RENDER_HIGHLIGHT__')
                  ),
                  t.booleanLiteral(renderHighlightEnabled)
                )
              )
            );
            // 4) Release 빌드에서도 런타임이 WebSocket 연결하도록 global 플래그 주입
            programPath.node.body.unshift(
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(
                    t.identifier('global'),
                    t.identifier('__REACT_NATIVE_MCP_ENABLED__')
                  ),
                  t.booleanLiteral(true)
                )
              )
            );
            state.runtimeInjected = true;
          }
        }

        path.replaceWith(
          t.callExpression(
            t.memberExpression(t.identifier(MCP_RUNTIME_ID), t.identifier('registerComponent')),
            node.arguments
          )
        );
      },
    },
  };
}
