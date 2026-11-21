import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Runs against the production build (`vite preview`) so the CSP is in force.
// The live Signet test is opt-in: LIVE_SIGNET=1 npm run test:e2e
const PORT = 4173;
const preinstalled = '/opt/pw-browsers/chromium';
const proxy = process.env.HTTPS_PROXY ? { server: process.env.HTTPS_PROXY, bypass: 'localhost,127.0.0.1' } : undefined;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'off',
    proxy,
    // Playwright 1.63 matches the pre-installed browser; fall back to its path explicitly if needed.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : existsSync(preinstalled) ? {} : {},
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 860 } } },
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, isMobile: false } },
  ],
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
