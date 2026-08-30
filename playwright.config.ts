import { defineConfig, devices } from '@playwright/test';

process.env.E2E_INVITE_CODE ??= process.env.TEST_INVITE_CODE ?? 'test-invite-code-1234';
process.env.E2E_ADMIN_USERNAME ??= 'host';
process.env.E2E_ADMIN_PASSWORD ??= 'a-test-admin-password';

export default defineConfig({
  testDir: './tests/e2e',
  use: { baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'mobile-chrome',
      testIgnore: '**/presenter-results.spec.ts',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'presenter-chrome',
      testMatch: '**/presenter-results.spec.ts',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1366, height: 768 },
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL ? undefined : {
    command: 'npm run dev',
    url: 'http://127.0.0.1:3000/api/health',
    reuseExistingServer: true,
  },
});
