import { defineConfig, devices } from '@playwright/test';
import { loadTestEnv } from './src/test/env';

// The e2e server is a production build pointed at the test database and a
// test Redis DB, with the mock SMS adapter and the dev inbox enabled.
loadTestEnv();
process.env.DEV_INBOX = 'true';

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Specs share the test database, Redis and the OTP rate limits.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL,
    ...devices['Pixel 5'],
    // AGENTS.md 7: mobile-first at 360×640.
    viewport: { width: 360, height: 640 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium-mobile', use: { browserName: 'chromium' } }],
  webServer: {
    command: `bunx next build && bunx next start --port ${PORT}`,
    url: `${baseURL}/api/health`,
    env: { ...(process.env as Record<string, string>), NODE_ENV: 'production', DEV_INBOX: 'true' },
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: 'pipe',
  },
});
