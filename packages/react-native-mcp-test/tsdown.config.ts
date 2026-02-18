import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli.ts',
  },
  format: 'es',
  outDir: 'dist',
  platform: 'node',
  dts: true,
  fixedExtension: false,
});
