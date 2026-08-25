import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed } from './seed';

let companyId: string;
let token: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
});

async function openImportExport(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
  await page.goto(`/companies/${companyId}?tab=import-export`);
  await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();
}

/** Hands the ledger input a file without touching the disk. */
async function uploadLedgers(page: Page, contents: string) {
  await page
    .locator('label', { hasText: 'Ledgers CSV' })
    .locator('input[type="file"]')
    .setInputFiles({ name: 'ledgers.csv', mimeType: 'text/csv', buffer: Buffer.from(contents) });
}

/**
 * Exporting the chart of accounts and reading it straight back in.
 *
 * This is the one journey the panel exists for, and the one the unit suite cannot prove. Those
 * tests mock `createLedger` and `updateLedger`, so they see what the screen *sends* and never what
 * the server makes of it — and what the server made of it was the whole defect: an empty cell went
 * up as `''`, which is not "no GSTIN" to a validator expecting a fifteen-character pattern, it is
 * a GSTIN that fails it.
 *
 * It mattered here more than anywhere. These books carry no tax layer at all, so GSTIN and PAN are
 * empty on every account of every one of them — meaning the round trip did not degrade at the
 * edges, it refused every row it was given.
 */
test.describe('exporting the chart and reading it back', () => {
  test('accepts a file whose optional columns are empty, and clears them', async ({ page }) => {
    await openImportExport(page);

    await uploadLedgers(
      page,
      'code,name,accountGroupCode,gstin,pan,contactEmail,contactPhone\n' +
        'HDFC_BANK,HDFC Bank — 4021,BANK_ACCOUNTS,,,,\n',
    );

    // The row is accepted by the real server, not merely sent.
    await expect(page.getByText(/1 updated/)).toBeVisible();
    await expect(page.getByText(/Refused|not a valid/)).toHaveCount(0);
  });

  test('carries a ledger currency in, which no other bulk path can set', async ({ page }) => {
    // The currency has to exist before an account can be denominated in it.
    const response = await page.request.post(
      `http://localhost:5099/api/v1/companies/${companyId}/currencies`,
      {
        headers: { Authorization: `Bearer ${token}` },
        data: { code: 'USD', symbol: '$', name: 'US Dollar' },
      },
    );
    expect([201, 409]).toContain(response.status());

    await openImportExport(page);

    await uploadLedgers(
      page,
      'code,name,accountGroupCode,currencyCode,creditLimit,creditDays\n' +
        'HDFC_BANK,HDFC Bank — 4021,BANK_ACCOUNTS,usd,50000,45\n',
    );

    await expect(page.getByText(/1 updated/)).toBeVisible();

    const ledgers = await page.request.get(
      `http://localhost:5099/api/v1/companies/${companyId}/ledgers`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = (await ledgers.json()) as {
      data: Array<{ code: string; currencyId?: string; creditLimit?: string; creditDays?: number }>;
    };
    const bank = body.data.find((ledger) => ledger.code === 'HDFC_BANK');

    // Read back off the server, which is the only place it counts.
    expect(bank?.currencyId).toBeTruthy();
    expect(bank?.creditDays).toBe(45);
  });

  test('refuses a row whose number column is not a number, rather than clearing it', async ({
    page,
  }) => {
    await openImportExport(page);

    await uploadLedgers(
      page,
      'code,name,accountGroupCode,creditLimit\n' +
        'HDFC_BANK,HDFC Bank — 4021,BANK_ACCOUNTS,fifty thousand\n',
    );

    await expect(page.getByText(/creditLimit is not a number/)).toBeVisible();
  });
});
