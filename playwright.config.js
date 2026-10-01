import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', fullyParallel: false, workers: 1, timeout: 60000,
  use: { baseURL: 'http://localhost:3100', channel: 'msedge', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  webServer: { command: 'node server/index.js', url: 'http://localhost:3100', reuseExistingServer: false, timeout: 120000, env: { PORT: '3100', DATABASE_PATH: 'data/e2e.sqlite' } },
  projects: [{ name: 'desktop', use: { viewport: { width: 1440, height: 1000 } } }]
});
