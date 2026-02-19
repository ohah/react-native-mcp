module.exports = {
  presets: [
    'module:@react-native/babel-preset',
    ['@ohah/react-native-mcp-server/babel-preset', { renderHighlight: true }],
  ],
  plugins: ['react-native-worklets/plugin'],
};
