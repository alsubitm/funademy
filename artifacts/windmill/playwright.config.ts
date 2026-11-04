import { defineConfig } from '@playwright/test';

const chromiumLaunch = process.env.WINDMILL_CHROMIUM_EXECUTABLE
  ? { executablePath: process.env.WINDMILL_CHROMIUM_EXECUTABLE }
  : {};
export default defineConfig({
  testDir: './tests/browser',
  outputDir: '../../generated-artifacts/windmill/test-results',
  reporter: [['list'], ['html', { outputFolder: '../../generated-artifacts/windmill/report', open: 'never' }]],
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:4178/windmill/',
    viewport: { width: 1440, height: 1000 },
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: ['chromium', 'firefox', 'webkit'].flatMap(browserName => [
    { name: browserName, use: { browserName: browserName as 'chromium' | 'firefox' | 'webkit', launchOptions: browserName === 'chromium' ? chromiumLaunch : {} } },
    {
      name: `${browserName}-touch`,
      use: {
        browserName: browserName as 'chromium' | 'firefox' | 'webkit',
        launchOptions: browserName === 'chromium' ? chromiumLaunch : {},
        viewport: { width: 390, height: 844 },
        hasTouch: true,
        // Firefox supports touch events but not Playwright's isMobile option.
        isMobile: browserName !== 'firefox',
      },
    },
  ]),
  webServer: {
    command: 'node tests/browser/serve.mjs',
    url: 'http://127.0.0.1:4178/windmill/',
    reuseExistingServer: false,
    timeout: 90_000,
  },
});
