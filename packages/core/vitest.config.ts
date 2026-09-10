import { defineConfig } from 'vitest/config';

// AGENTS.md 8: packages/core must keep >= 90% line coverage. Enforced when the
// package's tests run with --coverage (bun run --filter @kaithangu/core test -- --coverage).
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts'],
      reporter: ['text'],
      thresholds: {
        lines: 90,
      },
    },
  },
});
