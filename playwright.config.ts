import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const chromeExecutable = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const localChromeExecutable = process.platform === 'darwin' && existsSync(chromeExecutable)
  ? chromeExecutable
  : undefined;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:8787',
    trace: 'on-first-retry',
  },
  projects: [{
    name: 'chromium',
    use: {
      ...devices['Desktop Chrome'],
      launchOptions: {
        executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? localChromeExecutable,
      },
    },
  }],
  webServer: {
    command: 'npm run build && npm run dev -w @wison/api -- --port 8787',
    url: 'http://127.0.0.1:8787/api/v1/health',
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
