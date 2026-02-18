import { defineConfig } from 'tsdown';

export default defineConfig([
  {
    name: 'runtime',
    entry: { runtime: './src/runtime/index.ts' },
    format: 'iife',
    outDir: './',
    platform: 'neutral',
    target: 'es2015',
    clean: false,
    sourcemap: false,
    minify: false,
    dts: false,
    external: ['react-native'],
    outputOptions: {
      strictExecutionOrder: true,
      entryFileNames: 'runtime.js',
    },
  },
  {
    name: 'server',
    entry: {
      index: './src/index.ts',
      'transformer-entry': './src/transformer-entry.ts',
    },
    format: 'es',
    outDir: 'dist',
    platform: 'node',
    external: ['sharp'],
    dts: true,
    clean: true,
    fixedExtension: false,
    failOnWarn: false,
  },
  {
    name: 'babel-app-registry',
    entry: './src/babel-plugin-app-registry.ts',
    format: 'cjs',
    outDir: '.',
    platform: 'node',
    dts: false,
    clean: false,
    failOnWarn: false,
    outputOptions: {
      entryFileNames: 'babel-plugin-app-registry.cjs',
    },
  },
  {
    name: 'babel-inject-testid',
    entry: './src/babel-plugin-inject-testid.ts',
    format: 'cjs',
    outDir: '.',
    platform: 'node',
    dts: false,
    clean: false,
    failOnWarn: false,
    outputOptions: {
      entryFileNames: 'babel-plugin-inject-testid.cjs',
    },
  },
]);
