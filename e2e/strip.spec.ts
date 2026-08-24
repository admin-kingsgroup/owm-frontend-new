import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed, seedInvented } from './seed';

let companyId: string;
let token: string;

test.beforeAll(async () => {
  ({ token } = await seed());
  companyId = await seedInvented(token);
});

async function signIn(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
}

/**
 * The button bar, against a company that keeps a voucher type of its own.
 *
 * The bar used to be built from the fixed table of function keys, so it could only ever offer the
 * eight codes that table names. A type a company created itself was silently absent, and the only
 * way to raise one was to go back to the gateway and find it — which is the trip the bar exists to
 * save. Nothing in the unit suites can show that the strip is actually on screen everywhere, that
 * the keyless row lines up with the rest, or that pressing it opens the form on the right document.
 */
test.describe('the data entry strip', () => {
  test('offers every voucher type the company holds, in the order the keys run', async ({
    page,
  }) => {
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') faults.push(message.text());
    });

    await signIn(page);
    await page.goto(`/companies/${companyId}`);

    const group = page.getByRole('group', { name: 'Data entry' });
    await group.getByRole('button', { name: 'Petty Cash' }).waitFor();

    // Label then key, as the markup writes them; the strip prints the key first with `order`.
    expect(await group.getByRole('button').allTextContents()).toEqual([
      'ContraF4',
      'PaymentF5',
      'ReceiptF6',
      'JournalF7',
      'IncomeF8',
      'ExpenseF9',
      // No key left to give it, and a button all the same.
      'Petty Cash',
    ]);

    expect(faults, `the strip reported ${faults.length} fault(s)`).toEqual([]);
  });

  /* The whole point of the bar: data entry from wherever you are, not from the gateway. */
  test('is on screen away from the gateway too', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}/reports?report=trial-balance`);

    const group = page.getByRole('group', { name: 'Data entry' });
    await expect(group.getByRole('button', { name: 'Petty Cash' })).toBeVisible();
    await expect(group.getByRole('button', { name: /Income/ })).toBeVisible();
  });

  test('opens the form on the invented type, not on the first one it could find', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);

    await page.getByRole('button', { name: 'Petty Cash' }).click();

    await expect(page).toHaveURL(/vouchers\?new=PETTY_CASH/);
    await expect(page.getByLabel('Voucher type')).toHaveValue('PETTY_CASH');
  });

  test('still answers its function keys from another screen', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}/reports?report=day-book`);
    // The shell binds the keys once it has mounted; pressing before that tests nothing.
    await page
      .getByRole('group', { name: 'Data entry' })
      .getByRole('button', { name: /Receipt/ })
      .waitFor();

    await page.keyboard.press('F6');

    await expect(page).toHaveURL(/vouchers\?new=RECEIPT/);
  });

  /* The sheet documents the keyboard, so a row with an empty <kbd> would read as one that failed
     to print. */
  test('keeps the keyless type out of the shortcut sheet', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}?help=shortcuts`);

    const sheet = page.getByRole('dialog');
    await expect(sheet.getByText('Income', { exact: true })).toBeVisible();
    await expect(sheet.getByText('Petty Cash', { exact: true })).toHaveCount(0);
  });

  /* The strip and the Transactions menu are two doors to the same set of documents. Built from
     the same list in the same order, so neither can offer one the other does not. */
  test('agrees with the Transactions menu about what can be raised', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await page.getByRole('button', { name: 'Petty Cash' }).waitFor();

    await page.getByRole('button', { name: 'Transactions' }).click();
    const items = await page.getByRole('menuitem').allTextContents();

    expect(items.some((item) => item.includes('Petty Cash'))).toBe(true);
    expect(items.some((item) => item.includes('Income'))).toBe(true);
  });

  /* Twenty actions on a laptop that is not tall is the ordinary case, not an edge one. The bar
     scrolls inside itself; what must never happen is a row that is off the end and unreachable. */
  test('keeps every action reachable when the bar is taller than the screen', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 460 });
    await signIn(page);
    await page.goto(`/companies/${companyId}`);

    const last = page.getByRole('button', { name: 'Day Book' });
    await last.scrollIntoViewIfNeeded();
    await expect(last).toBeInViewport();

    const petty = page.getByRole('button', { name: 'Petty Cash' });
    await petty.scrollIntoViewIfNeeded();
    await expect(petty).toBeInViewport();
  });

  test('fits on a narrow screen, keyless row included', async ({ page }) => {
    await page.setViewportSize({ width: 420, height: 820 });
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await page.getByRole('button', { name: 'Petty Cash' }).waitFor();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the page scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);

    /*
      Laid out in a row each action is a chip, and the key sits at its far end. An empty key slot
      would stretch the keyless one into a wide box with its label pinned left.
    */
    const widths = await page.evaluate(() => {
      const bar = document.querySelector('[aria-label="Actions for this screen"]');
      const buttons = [...(bar?.querySelectorAll('button') ?? [])];
      const widthOf = (text: string) => {
        const found = buttons.find((button) => (button.textContent ?? '').startsWith(text));
        return found ? Math.round(found.getBoundingClientRect().width) : -1;
      };
      return { petty: widthOf('Petty Cash'), contra: widthOf('Contra') };
    });

    expect(widths.petty).toBeGreaterThan(0);
    expect(
      widths.petty,
      `the keyless chip is ${widths.petty}px against ${widths.contra}px for a keyed one`,
    ).toBeLessThanOrEqual(widths.contra + 20);
  });
});
