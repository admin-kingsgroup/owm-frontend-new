import { test, expect } from '@playwright/test';

import { seed } from './seed';

let companyId: string;
let token: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
});

/**
 * Syncing default masters, from the screen that offers it.
 *
 * The state that matters is a company behind the current master set, and no seeded company is ever
 * in it — one is created at the version the product is on. So the reads are rewritten to make it
 * look like a book created before the last release, which is where the three live ones actually
 * stand. What the server does with the sync is not faked: it answers truthfully that this company
 * is current, and the panel is judged on how it reports that and what it stops offering.
 */

/** Makes every company the app reads look like one created before the current master set. */
async function pretendBehind(page: import('@playwright/test').Page) {
  await page.route('**/api/v1/companies**', async (route) => {
    // Reads only. The sync itself posts under the same path and answers a count, not a company —
    // rewriting that told the panel the version had not moved and it believed it.
    if (route.request().method() !== 'GET') return route.continue();

    const response = await route.fetch();
    const body = await response.json();
    const rewrite = (company: Record<string, unknown>) => ({ ...company, seedVersion: 3 });
    const data = Array.isArray(body.data) ? body.data.map(rewrite) : rewrite(body.data);
    await route.fulfill({ response, json: { ...body, data } });
  });
}

test('a company behind says so, and stops saying it once synced', async ({ page }) => {
  const faults: string[] = [];
  page.on('pageerror', (error) => faults.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') faults.push(message.text());
  });

  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
  await pretendBehind(page);

  await page.goto(`/companies/${companyId}?tab=settings`);

  await expect(page.getByText('version 3 of 4')).toBeVisible();
  await expect(page.getByText(/Syncing gives this company/)).toBeVisible();
  const sync = page.getByRole('button', { name: 'Sync' });
  await expect(sync).toBeVisible();
  await page.screenshot({ path: 'e2e/screenshots/_behind.png', fullPage: true });

  await sync.click();

  // The server holds the truth: this company really is current, so nothing is inserted.
  await expect(page.getByRole('status')).toContainText('Nothing to add');
  await expect(page.getByText('version 4 · up to date')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sync' })).toHaveCount(0);
  await expect(page.getByText(/Syncing gives this company/)).toHaveCount(0);
  await page.screenshot({ path: 'e2e/screenshots/_after-sync.png', fullPage: true });

  expect(faults, `the panel reported ${faults.length} fault(s)`).toEqual([]);
});
