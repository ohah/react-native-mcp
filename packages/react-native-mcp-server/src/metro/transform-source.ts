/**
 * Metro 커스텀 transformer용 소스 변환 (AST 기반)
 *
 * 앱 진입점에서 AppRegistry.registerComponent 호출을 찾아
 * MCP 런타임 래퍼로 감싸서, CLI 테스트로 동작 여부를 검증할 수 있게 한다.
 */

// 번들 후 CJS/ESM interop으로 default가 달라질 수 있음
import traverseModule from '@babel/traverse';
import generateModule from '@babel/generator';

const traverse = (traverseModule as { default?: typeof traverseModule }).default ?? traverseModule;
const generate = (generateModule as { default?: typeof generateModule }).default ?? generateModule;
import * as parser from '@babel/parser';
import * as t from '@babel/types';

const MCP_RUNTIME_ID = '__REACT_NATIVE_MCP__';

/** traverse visitor에서 받는 path (타입만 명시) */
interface TraversePath {
  node: t.Node;
  replaceWith(node: t.Node): void;
}

/**
 * 소스 코드를 AST로 파싱한 뒤 AppRegistry.registerComponent 호출을
 * __REACT_NATIVE_MCP__.registerComponent(...) 로 감싼 코드로 변환
 *
 * @param src - 변환할 소스 문자열
 * @param filename - 파일 경로 (소스맵용, 선택)
 * @returns 변환된 code (그리고 추후 sourceMap)
 */
export async function transformSource(src: string, filename?: string): Promise<{ code: string }> {
  const ast = parser.parse(src, {
    sourceType: 'module',
    plugins: ['jsx', 'typescript'],
    sourceFilename: filename ?? 'entry.js',
  });

  traverse(ast, {
    CallExpression(path: TraversePath) {
      const node = path.node;
      if (!t.isCallExpression(node)) return;
      if (!t.isMemberExpression(node.callee)) return;
      const { object, property } = node.callee;
      if (!t.isIdentifier(object) || !t.isIdentifier(property)) return;
      if (object.name !== 'AppRegistry' || property.name !== 'registerComponent') return;

      // AppRegistry.registerComponent(...) → __REACT_NATIVE_MCP__.registerComponent(...)
      path.replaceWith(
        t.callExpression(
          t.memberExpression(t.identifier(MCP_RUNTIME_ID), t.identifier('registerComponent')),
          node.arguments
        )
      );
    },
  });

  const output = generate(ast, {
    retainLines: false,
    compact: false,
  });

  return { code: output.code };
}
