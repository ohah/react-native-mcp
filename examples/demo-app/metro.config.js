const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

/**
 * 모노레포 루트 (examples/demo-app 에서 두 단계 위)
 */
const workspaceRoot = path.resolve(__dirname, '../..');

/**
 * Metro 설정
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = getDefaultConfig(__dirname);

module.exports = mergeConfig(config, {
  watchFolders: [workspaceRoot],
  resolver: {
    ...config.resolver,
    nodeModulesPaths: [
      path.resolve(__dirname, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
  },
});
