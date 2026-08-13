import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  outDir: 'dist',
  clean: true,
  noExternal: [/.*/], // Bundle all dependencies
  minify: false,
  sourcemap: false,
  target: 'node24',
});
