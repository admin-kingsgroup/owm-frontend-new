import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed } from './seed';

let companyId: string;
let token: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
});

async function signIn(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
}

/**
 * Makes every company the app reads look like one created before the current master set.
 *
 * Reads only. The sync posts under the same path and answers a count, not a company — rewriting
 * that told the panel the version had not moved and it believed it.
 */
async function stampedBehind(page: Page) {
  await page.route(/\/api\/v1\/companies(\?|$|\/[a-f0-9]+$)/, async (route) => {
    if (route.request().method() !== 'GET') return route.continue();

    const response = await route.fetch();
    const body = await response.json();
    const rewrite = (company: Record<string, unknown>) => ({ ...company, seedVersion: 3 });
    const data = Array.isArray(body.data) ? body.data.map(rewrite) : rewrite(body.data);
    await route.fulfill({ response, json: { ...body, data } });
  });
}

function watchFaults(page: Page) {
  const faults: string[] = [];
  page.on('pageerror', (error) => faults.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') faults.push(message.text());
  });
  return faults;
}

/**
 * Syncing default masters, from the screen that offers it.
 *
 * The state that matters is a company behind the current master set, and no seeded company is ever
 * in it — one is created at the version the product is on. So the reads are rewritten to make it
 * look like a book created before the last release, which is where the three live ones actually
 * stand. What the server is asked is not faked in the first case at all: it answers truthfully
 * that this company has nothing to receive, which is the whole point of asking before offering.
 */
test.describe('syncing default masters', () => {
  test('says nothing is waiting, and offers no control, when nothing applies', async ({ page }) => {
    const faults = watchFaults(page);
    await signIn(page);
    await stampedBehind(page);

    await page.goto(`/companies/${companyId}?tab=settings`);

    // The stamp is older and is said so — the server was asked and there is nothing to receive.
    await expect(page.getByText('version 3 of 4')).toBeVisible();
    await expect(page.getByText(/Nothing in version 4 applies to this kind of books/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync' })).toHaveCount(0);

    await page.screenshot({ path: 'e2e/screenshots/_masters-nothing-applies.png', fullPage: true });
    expect(faults, `the panel reported ${faults.length} fault(s)`).toEqual([]);
  });

  test('names what is waiting, and stops offering it once run', async ({ page }) => {
    const faults = watchFaults(page);
    await signIn(page);
    await stampedBehind(page);

    // The one thing the seeded database cannot produce: rows genuinely waiting.
    await page.route('**/default-masters/pending', async (route) => {
      await route.fulfill({
        json: {
          success: true,
          data: { accountGroups: 3, ledgers: 0, voucherTypes: 2, numberSeries: 2 },
        },
      });
    });

    await page.goto(`/companies/${companyId}?tab=settings`);

    await expect(page.getByText('version 3 of 4')).toBeVisible();
    await expect(
      page.getByText(
        /Waiting for this company: 3 account groups, 2 voucher types and 2 number series\./,
      ),
    ).toBeVisible();

    const sync = page.getByRole('button', { name: 'Sync' });
    await expect(sync).toBeVisible();
    await page.screenshot({ path: 'e2e/screenshots/_masters-waiting.png', fullPage: true });

    await sync.click();

    // The sync itself is not faked: the server holds the truth about what this company has.
    await expect(page.getByRole('status')).toContainText('Nothing to add');
    await expect(page.getByText('version 4 · up to date')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sync' })).toHaveCount(0);
    await expect(page.getByText(/Syncing gives this company/)).toHaveCount(0);

    expect(faults, `the panel reported ${faults.length} fault(s)`).toEqual([]);
  });
});
