import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';

dotenv.config();

// tsx is needed in the runner/workers so payload.config resolves `next/cache`.
// Next must not inherit it: it breaks next.config.ts loading.
const serverNodeOptions = (process.env.NODE_OPTIONS ?? '')
  .replace(/--import[=\s]+\S*tsx\S*/g, '')
  .trim();

const isCI = !!process.env.CI;
const port = Number(process.env.E2E_PORT ?? 3000);
const baseURL = process.env.E2E_BASE_URL ?? `http://localhost:${port}`;

export default defineConfig({
  testDir: './tests/e2e',
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: isCI
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'setup',
      testDir: './tests/setup',
      testMatch: /.*\.setup\.ts/,
      teardown: 'teardown',
    },
    {
      name: 'teardown',
      testDir: './tests/setup',
      testMatch: /.*\.teardown\.ts/,
    },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: isCI ? 'bun run build && bun run start' : 'bun run dev',
    url: baseURL,
    reuseExistingServer: !isCI,
    timeout: 180_000,
    env: { NODE_OPTIONS: serverNodeOptions },
  },
});
