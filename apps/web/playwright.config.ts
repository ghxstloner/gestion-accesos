import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the SGA web app.
 *
 * These E2E tests are *lifecycle* tests: they exercise a real browser against
 * a running dev API + dev DB. They are skipped automatically when the dev API
 * at {@link API_BASE_URL} is unreachable, so CI without the dev stack still
 * passes (and `npm run e2e:lifecycle` is a manual/local-dev responsibility).
 *
 * The dev fixtures required live in apps/api/prisma/seed.ts:
 *   - SYSTEM_ADMIN  document 8-234-567 / Demo1234!  (company #0 AAC)
 *   - COMPANY_ADMIN document 4-345-678 / Demo1234!  (company #1 MD Panama)
 *
 * Run locally with:  npx playwright test
 *
 * Environment overrides:
 *   SGA_E2E_WEB_URL    defaults to http://localhost:3000
 *   SGA_E2E_API_URL    defaults to http://localhost:4000   (only probed)
 */
const webUrl = process.env.SGA_E2E_WEB_URL ?? 'http://localhost:3000';
const apiUrl = process.env.SGA_E2E_API_URL ?? 'http://localhost:4000';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: webUrl,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // No webServer auto-start: developers run the API + web dev servers. The
  // suite skips when the API is not reachable (see e2e/helpers.ts).
  metadata: { apiUrl },
});
