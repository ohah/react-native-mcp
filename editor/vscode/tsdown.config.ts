import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    name: 'extension',
    entry: { extension: './src/extension/extension.ts' },
    format: 'cjs',
    outDir: 'dist',
    platform: 'node',
    external: ['vscode'],
    noExternal: ['ws'],
    dts: false,
    clean: true,
    sourcemap: true,
    failOnWarn: false,
    outputOptions: {
      entryFileNames: 'extension.js',
    },
  },
  {
    name: 'webview',
    entry: { webview: './src/webview/index.tsx' },
    format: 'iife',
    outDir: 'dist',
    platform: 'browser',
    target: 'es2020',
    dts: false,
    clean: false,
    sourcemap: false,
    failOnWarn: false,
    inlineOnly: false,
    outputOptions: {
      entryFileNames: 'webview.js',
    },
  },
]);
