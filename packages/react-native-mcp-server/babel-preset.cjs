'use strict';

/**
 * Babel preset: AppRegistry 래핑 + testID 자동 주입
 * babel.config.js에서 presets에 한 번만 넣으면 됨.
 */
module.exports = function () {
  return {
    plugins: [
      require('./babel-plugin-app-registry.cjs'),
      require('./babel-plugin-inject-testid.cjs'),
    ],
  };
};
