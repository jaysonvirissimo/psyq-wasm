// SPDX-License-Identifier: MIT
// Benchmark run, separate from the test run so `npm run test:browser` stays a
// correctness suite. Reuses the same three browsers and the same static server.
import { defineConfig, devices } from '@playwright/test';

const PORT = 4173;

export default defineConfig({
  testDir: 'test/browser',
  testMatch: '**/*.perf.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 15 * 60_000,
  use: { baseURL: `http://127.0.0.1:${String(PORT)}` },
  webServer: {
    command: `node scripts/serve.mjs ${String(PORT)}`,
    url: `http://127.0.0.1:${String(PORT)}/test/browser/page/`,
    reuseExistingServer: process.env['CI'] === undefined,
    timeout: 30_000,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
