const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * 모노레포 루트 (examples/demo-app 에서 두 단계 위)
 */
const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * MCP transformer: AppRegistry 감싸기 + testID 자동 주입
 */
const mcpTransformerPath = path.resolve(
  workspaceRoot,
  'packages/react-native-mcp-server/metro-transformer.cjs'
);

/**
 * Metro 설정
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

module.exports = mergeConfig(config, {
  watchFolders: [workspaceRoot],
  transformer: {
    ...config.transformer,
    babelTransformerPath: mcpTransformerPath,
  },
  resolver: {
    ...config.resolver,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
});
