import { test as base, expect, type Page } from '@playwright/test';

/**
 * Shared Playwright helpers for SGA lifecycle tests.
 *
 * Tests are skipped when the dev API is not running, because they depend on
 * the deterministic seed fixtures (see prisma/seed.ts). Skipping (rather than
 * failing) keeps the suite useful when running offline against static builds.
 */

const apiUrl = process.env.SGA_E2E_API_URL ?? 'http://localhost:4000';

/**
 * Probe the dev API once per worker; the suite is skipped if it's down.
 * Cached on the module so multiple tests share a single check.
 */
let apiReachableCache: boolean | null = null;
async function isApiReachable(): Promise<boolean> {
  if (apiReachableCache !== null) return apiReachableCache;
  try {
    const res = await fetch(`${apiUrl}/api/v1/health`, {
      method: 'GET',
    });
    apiReachableCache = res.ok;
  } catch {
    apiReachableCache = false;
  }
  return apiReachableCache;
}

/**
 * Extended test fixture that auto-skips when the dev API is not reachable.
 */
export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    const ok = await isApiReachable();
    if (!ok) {
      testInfo.skip(true, 'dev API at ' + apiUrl + ' is not reachable');
      return;
    }
    await use(page);
  },
});

export { expect };

/** Dev fixture credentials — must match apps/api/prisma/seed.ts. */
export const FIXTURES = {
  systemAdmin: { documentNumber: '8-234-567', password: 'Demo1234!' },
  companyAdminOtherTenant: {
    documentNumber: '4-345-678',
    password: 'Demo1234!',
  },
} as const;

/**
 * Login through the UI. Returns once the authed shell (dashboard) is visible.
 *
 * Locators target element IDs/names directly rather than accessible labels
 * because the login form's "show password" toggle is also labelled with the
 * word "contraseña" and would create a strict-mode violation.
 *
 * When the test runner hits the dev API's throttler for the login endpoint
 * (short-bucket: 5 attempts / 60s) subsequent calls will be rejected with
 * HTTP 429 and the SPA will display a throttled-error state instead of
 * advancing to /dashboard. This helper throws in that case so callers can
 * decide to skip rather than block the whole pipeline.
 */
export async function loginViaUi(
  page: Page,
  creds: { documentNumber: string; password: string },
): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="documentNumber"]', creds.documentNumber);
  await page.fill('input[name="password"]', creds.password);
  await page
    .getByRole('button', { name: /iniciar sesión|ingresar|sign in|entrar/i })
    .click();
  // Wait until the authed layout mounts (URL changes to /dashboard) OR a
  // throttled / error state appears. Bounded to 8s so callers can skip
  // gracefully rather than burn default Playwright timeouts.
  await Promise.race([
    page.waitForURL(/\/(dashboard|inicio)/i, { timeout: 8_000 }),
    page
      .getByText(/muchos intentos|too many|throttl|429/i)
      .waitFor({ timeout: 8_000 })
      .then(() => {
        throw new Error('login-throttled');
      }),
  ]);
}
