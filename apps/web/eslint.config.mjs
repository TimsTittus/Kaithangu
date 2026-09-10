import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import { createConfig } from '@kaithangu/config/eslint';

export default defineConfig([
  ...nextVitals,
  ...createConfig(import.meta.dirname),
  globalIgnores(['.next/**', 'out/**', 'build/**', 'next-env.d.ts']),
]);
