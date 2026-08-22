import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed } from './seed';

let companyId: string;
let token: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
});

/**
 * Signs in the way the app does, by putting the token where it keeps it, so the first paint is the
 * signed-in one. Logging in through the form would work too, but it makes every test wait on a
 * screen that is not the one being checked.
 */
async function signIn(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
}

/** The four screens the interface direction is built around, plus the list they hang off. */
const SCREENS = [
  { name: 'gateway', path: () => `/companies/${companyId}` },
  { name: 'reports-balance-sheet', path: () => `/companies/${companyId}/reports` },
  {
    name: 'reports-trial-balance',
    path: () => `/companies/${companyId}/reports?report=trial-balance`,
  },
  { name: 'vouchers', path: () => `/companies/${companyId}/vouchers` },
  { name: 'voucher-entry', path: () => `/companies/${companyId}/vouchers?new=CONTRA` },
  { name: 'masters', path: () => `/companies/${companyId}?tab=accounts` },
  { name: 'shortcuts', path: () => `/companies/${companyId}?help=shortcuts` },
];

test.describe('every screen, drawn', () => {
  for (const screen of SCREENS) {
    test(`${screen.name} draws without overflowing or erroring`, async ({ page }) => {
      const faults: string[] = [];
      page.on('pageerror', (error) => faults.push(`uncaught: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() === 'error') faults.push(`console: ${message.text()}`);
      });

      await signIn(page);
      await page.goto(screen.path());
      // The frame is on every screen; waiting for it means waiting for the app, not for a spinner.
      await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();
      await page.waitForLoadState('networkidle');

      await page.screenshot({
        path: `e2e/screenshots/${screen.name}.png`,
        fullPage: true,
      });

      /*
        The page must never scroll sideways. A statement is wide and a voucher grid is wider, and
        the failure mode is always the same: one column pushes the document past the viewport and
        the figures at the end of every row become unreachable.
      */
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen.name} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

      expect(faults, `${screen.name} reported ${faults.length} fault(s)`).toEqual([]);
    });
  }
});

test.describe('the frame', () => {
  test('states the year the statements are actually run for', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}/reports?report=trial-balance`);

    const strip = page.locator('header + div').first();
    await expect(strip).toContainText('Financial year');

    /*
      The fault this guards against shipped once: the strip read the company record's first year and
      said 2019 above a 2026 statement. Both now come from the server's own period, so the year on
      the strip and the year under the report's title must be the same string.
    */
    const year = new Date().getUTCFullYear().toString();
    await expect(strip).toContainText(year);
    await expect(page.getByRole('heading', { name: 'Trial Balance' })).toBeVisible();
  });

  test('opens a menu with its mnemonic and goes where the item points', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    await page.keyboard.press('Alt+KeyR');
    await expect(page.getByRole('menu')).toBeVisible();

    await page.getByRole('menuitem', { name: /Day Book/ }).click();
    await expect(page).toHaveURL(/report=day-book/);
  });

  test('raises a voucher from a function key, on any screen', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}/reports`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    await page.keyboard.press('F4');

    await expect(page).toHaveURL(/vouchers\?new=CONTRA/);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  /**
   * The form reads the ledger list once, when it mounts, to decide what each line starts on. Opened
   * before that list arrives — which is what a function key does on a cold page — every line held an
   * empty account code while the select showed the first account as though it had been chosen, and
   * the balance beside it could not be found. It looked entirely normal and would have posted a
   * voucher against no account at all.
   */
  test('opens the form on a real account, not one the select only appears to show', async ({
    page,
  }) => {
    await signIn(page);
    // Straight to the form, so the masters are still in flight as it opens.
    await page.goto(`/companies/${companyId}/vouchers?new=CONTRA`);

    const firstLine = page.getByRole('dialog').locator('tbody tr').first();
    await expect(firstLine.locator('select')).toBeVisible();

    // The balance is found only if the line holds the code the select is showing.
    await expect(firstLine.locator('td').nth(1)).not.toHaveText('—');
  });
});

/**
 * The phone is not a second design, but nothing may overflow and no control may be too small to
 * hit. These are the two guarantees; the density is deliberate everywhere else.
 */
test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the gateway fits, and its controls are reachable', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await page.screenshot({ path: 'e2e/screenshots/gateway-narrow.png', fullPage: true });

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the gateway scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

    const menuButton = page.getByRole('button', { name: 'Open navigation' });
    const box = await menuButton.boundingBox();
    expect(box?.height ?? 0, 'the menu button is smaller than a fingertip').toBeGreaterThanOrEqual(
      40,
    );
  });
});
