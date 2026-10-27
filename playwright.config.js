import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for Emergency Response System
 * 
 * Tests are located in the e2e/ directory
 * Run tests with: npm run test
 * Run tests in headed mode: npm run test:headed
 * Run tests in UI mode: npm run test:ui
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120000,
  // Specs mutate shared live state (accounts, boundary, contacts, reports)
  // — parallel workers corrupt each other, so always run serially.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:4190',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 60000,
  },

  expect: {
    timeout: 15000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm start',
    url: 'http://localhost:4190',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
