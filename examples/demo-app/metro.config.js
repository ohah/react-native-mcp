const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * 모노레포 루트 (examples/demo-app 에서 두 단계 위)
 */
const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Metro 설정
 * MCP 변환(AppRegistry 래핑, testID 주입)은 babel.config.js 플러그인으로 적용.
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);
module.exports = mergeConfig(config, {
  server: {
    port: 8230,
  },
  watchFolders: [workspaceRoot],
  resolver: {
    ...config.resolver,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
});
