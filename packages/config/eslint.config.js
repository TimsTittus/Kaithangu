import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

/**
 * Shared flat config. Each workspace calls this with its own directory so the
 * typescript-eslint project service resolves that workspace's tsconfig.json.
 * @param {string} tsconfigRootDir
 */
export function createConfig(tsconfigRootDir) {
  return defineConfig([
    globalIgnores(['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**']),
    {
      files: ['**/*.{ts,tsx,mts,cts}'],
      extends: [tseslint.configs.recommendedTypeChecked],
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/ban-ts-comment': 'error',
        '@typescript-eslint/consistent-type-imports': 'error',
        '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      },
    },
    {
      files: ['**/*.{js,mjs,cjs}'],
      extends: [tseslint.configs.recommended, tseslint.configs.disableTypeChecked],
    },
  ]);
}
