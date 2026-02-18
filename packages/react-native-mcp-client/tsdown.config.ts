import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: 'src/index.ts',
  format: 'es',
  outDir: 'dist',
  platform: 'node',
  dts: true,
  fixedExtension: false,
});
