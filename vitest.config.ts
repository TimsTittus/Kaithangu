import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/web', 'apps/voice', 'apps/jobs', '!packages/config'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/*/src/**'],
      exclude: ['**/*.test.ts', '**/*.d.ts'],
      reporter: ['text', 'html'],
    },
  },
});
