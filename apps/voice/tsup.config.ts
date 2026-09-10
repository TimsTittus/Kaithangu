import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  sourcemap: true,
  clean: true,
  // Internal packages ship TypeScript source, so they must be bundled.
  noExternal: [/^@kaithangu\//],
});
