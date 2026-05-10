import { defineConfig, devices } from '@playwright/test';

const port = process.env.PORT ?? '{{DEV_PORT}}';
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './specs',
  globalSetup: require.resolve('./globalSetup'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    // Run via the worktree wrappers so the dev server gets the same DB +
    // port that the test harness expects. Whoever is invoking the test
    // already passed through with-worktree-db.sh / with-worktree-port.sh,
    // so $PORT and $DATABASE_URL are populated; the inner command just
    // honors them.
    command: process.env.CI
      ? `{{PKG_MGR}} build && {{PKG_MGR}} start -p ${port}`
      : `{{PKG_MGR}} dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    stderr: 'pipe',
    timeout: 120_000,
  },
});
