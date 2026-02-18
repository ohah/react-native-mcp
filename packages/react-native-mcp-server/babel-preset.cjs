'use strict';

/**
 * Babel preset: AppRegistry 래핑 + testID 자동 주입
 * babel.config.js에서 presets에 한 번만 넣으면 됨.
 * REACT_NATIVE_MCP_ENABLED가 true/1이 아니면 플러그인 미적용(번들에 MCP 코드 없음).
 */
function isMcpEnabled() {
  const v = process.env.REACT_NATIVE_MCP_ENABLED;
  return v === 'true' || v === '1';
}

module.exports = function () {
  if (!isMcpEnabled()) {
    return { plugins: [] };
  }
  return {
    plugins: [
      require('./babel-plugin-app-registry.cjs'),
      require('./babel-plugin-inject-testid.cjs'),
    ],
  };
};
