'use strict';

/**
 * Babel preset: AppRegistry 래핑 + testID 자동 주입
 * babel.config.js에서 presets에 한 번만 넣으면 됨.
 * - __DEV__ 빌드: 자동 활성화 (환경변수 불필요)
 * - Release 빌드: REACT_NATIVE_MCP_ENABLED=true|1 일 때만 활성화
 *
 * 옵션 (두 번째 인자로 객체 전달):
 * - renderHighlight (boolean, default: false): 앱 로드 시 렌더 하이라이트 오버레이를 켤지 여부
 *
 * @example
 * presets: [
 *   ['@ohah/react-native-mcp-server/babel-preset', { renderHighlight: true }],
 * ]
 */
function isMcpEnabled() {
  // Metro는 DEV 빌드 시 NODE_ENV를 'development'로 설정한다
  if (process.env.NODE_ENV !== 'production') return true;
  const v = process.env.REACT_NATIVE_MCP_ENABLED;
  return v === 'true' || v === '1';
}

module.exports = function (api, options) {
  if (!isMcpEnabled()) {
    return { plugins: [] };
  }
  const opts = options || {};
  const renderHighlight = opts.renderHighlight === true;
  return {
    plugins: [
      [require('./babel-plugin-app-registry.cjs'), { renderHighlight }],
      require('./babel-plugin-inject-testid.cjs'),
    ],
  };
};
