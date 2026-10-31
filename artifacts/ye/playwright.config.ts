import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './browser-tests',
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  outputDir: '../../generated-artifacts/browser-tests',
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:3107',
    headless: true,
    trace: 'retain-on-failure',
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  webServer: {
    command: 'pnpm exec tsx browser-tests/server.ts',
    url: 'http://127.0.0.1:3107/admin',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
