import { defineConfig } from '@playwright/test';

const FRONTEND = 'http://localhost:5173';

export default defineConfig({
  testDir: '.',
  // The live MLB API is occasionally slow; these are not tight-loop unit tests.
  timeout: 60_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: FRONTEND,
    trace: 'retain-on-failure',
    // Chromium is preinstalled in the dev container; CI installs it explicitly.
    ...(process.env.PLAYWRIGHT_BROWSERS_PATH
      ? { launchOptions: { executablePath: '/opt/pw-browsers/chromium' } }
      : {}),
  },
  webServer: [
    {
      command: 'npm run dev:backend',
      url: 'http://localhost:4000/healthz',
      cwd: '..',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npm run dev:frontend',
      url: FRONTEND,
      cwd: '..',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
