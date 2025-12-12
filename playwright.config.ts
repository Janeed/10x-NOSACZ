import { defineConfig, devices } from '@playwright/test';

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    // Setup project for authentication
    {
      name: 'setup',
      testMatch: /auth\.setup\.ts/,
    },
    // Main test project with authentication
    {
      name: 'chromium-desktop',
      use: {
        ...devices['Desktop Chrome'],
        // Use authenticated state from setup
        storageState: '.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],
  webServer: {
    command: process.env.E2E_WEB_SERVER_CMD ?? 'npm run dev',
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

