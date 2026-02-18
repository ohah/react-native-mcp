import { defineConfig } from 'tsdown';

export default defineConfig({
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
});
