import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed, seedAnalytics, seedInvented } from './seed';

let companyId: string;
let portfolioId: string;
let token: string;

test.beforeAll(async () => {
  ({ token } = await seed());
  companyId = await seedInvented(token);
  portfolioId = await seedAnalytics(token);
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

/**
 * The same strip, for the workspace that measures other people's businesses.
 *
 * It was skipped entirely while nothing was ever posted to one — no Data entry group at all, and a
 * Transactions menu naming only the registry. That stopped being true when the workspace was seeded
 * with four voucher types of its own, and nothing in the unit suites can show that the four are on
 * screen, on the keys the books' four would have used, or that the vouchers screen accepts a company
 * it used to turn away at the door.
 */
test.describe('the data entry strip in a portfolio workspace', () => {
  test('offers the four it is seeded with, on F4 to F7', async ({ page }) => {
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') faults.push(message.text());
    });

    await signIn(page);
    await page.goto(`/companies/${portfolioId}`);

    const group = page.getByRole('group', { name: 'Data entry' });
    await group.getByRole('button', { name: 'Adjustment' }).waitFor();

    // In the order a month is worked, not alphabetically: money in, earned, allocated, fixes last.
    expect(await group.getByRole('button').allTextContents()).toEqual([
      'Capital IntroductionF4',
      'Business ProfitF5',
      'Profit AllocationF6',
      'AdjustmentF7',
    ]);

    expect(faults, `the workspace reported ${faults.length} fault(s)`).toEqual([]);
  });

  /* Both, not one instead of the other — the registry is still what the workspace is mostly for. */
  test('keeps the portfolio on the Transactions menu beside them', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${portfolioId}`);
    await page.getByRole('button', { name: 'Adjustment' }).waitFor();

    await page.getByRole('button', { name: 'Transactions' }).click();

    expect(await page.getByRole('menuitem').allTextContents()).toEqual([
      'Portfolio',
      'Vouchers',
      'Capital IntroductionF4',
      'Business ProfitF5',
      'Profit AllocationF6',
      'AdjustmentF7',
    ]);
  });

  test('reads its vouchers on the vouchers screen, and is sent elsewhere to write them', async ({
    page,
  }) => {
    /*
      The screen refused this company outright before, which made its own vouchers unreadable. It
      lists them now — but raising one here cannot work: the accounts are namespaced with a slash
      by the business registry and the voucher API validates `ledgerCode` as `[A-Z0-9_]+`, so the
      form balances and then answers `ledgerCode must be alphanumeric` on accept.
    */
    await signIn(page);
    await page.goto(`/companies/${portfolioId}/vouchers`);

    await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible();
    await expect(page.getByText('This company does not post vouchers')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /New voucher/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Open the portfolio/ })).toBeVisible();
  });

  test('cannot be talked into the voucher form by an old bookmark', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${portfolioId}/vouchers?new=CAPITAL_INTRODUCTION`);

    await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible();
    // The form would fill and balance and then be refused, so it is never opened at all.
    await expect(page.getByLabel('Voucher type')).toHaveCount(0);
  });

  test('still answers its function keys from the registry screen', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${portfolioId}`);
    await page
      .getByRole('group', { name: 'Data entry' })
      .getByRole('button', { name: 'Business Profit' })
      .waitFor();

    await page.keyboard.press('F5');

    await expect(page).toHaveURL(/kg\?raise=BUSINESS_PROFIT/);
  });
});
