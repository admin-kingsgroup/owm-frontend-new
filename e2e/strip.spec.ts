import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed, seedAnalytics, seedInvented } from './seed';

const API = process.env.VITE_API_BASE_URL ?? 'http://localhost:5099/api/v1';

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

async function api(path: string, init: { method?: string; body?: unknown } = {}) {
  const response = await fetch(`${API}${path}`, {
    method: init.method ?? 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  return { status: response.status, body: await response.json().catch(() => null) };
}

/**
 * A bank account and an expense head for the workspace itself.
 *
 * Deliberately not in `seedAnalytics`: every other check draws that company, and two more ledgers
 * would move the pictures and the counts they assert. What these are for is the one thing seed v6
 * exists to allow — a workspace filing its *own* money, which needs somewhere for it to come from
 * and somewhere for it to go.
 */
async function giveThePortfolioItsOwnAccounts() {
  const held = (await api(`/companies/${portfolioId}/ledgers`)).body?.data ?? [];
  if (held.some((ledger: { code: string }) => ledger.code === 'KG_BANK')) return;

  const groups = (await api(`/companies/${portfolioId}/account-groups`)).body?.data ?? [];
  const groupCode = (code: string) =>
    groups.find((group: { code: string }) => group.code === code)?.code;

  await api(`/companies/${portfolioId}/ledgers`, {
    method: 'POST',
    body: {
      code: 'KG_BANK',
      name: 'Workspace Current Account',
      accountGroupCode: groupCode('BANK_ACCOUNTS'),
    },
  });
  await api(`/companies/${portfolioId}/ledgers`, {
    method: 'POST',
    body: {
      code: 'KG_FEES',
      name: 'Professional Fees',
      accountGroupCode: groupCode('INDIRECT_EXPENSES'),
    },
  });
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
 * Transactions menu naming only the registry. A workspace holds eight documents now: the four it
 * files about a business it tracks, and from seed v6 the four every posting company has for its own
 * money. Nothing in the unit suites can show that all eight are on screen, that the two sets keep
 * separate keys, or that each goes to the door that can actually accept it.
 */
const PORTFOLIO_STRIP = [
  'ContraF4',
  'PaymentF5',
  'ReceiptF6',
  'JournalF7',
  // On the Ctrl row: the four above claim F4 to F7, being earlier in the key table.
  'Capital IntroductionCtrl+F6',
  'Business ProfitCtrl+F7',
  'Profit AllocationCtrl+F8',
  'AdjustmentCtrl+F9',
];

test.describe('the data entry strip in a portfolio workspace', () => {
  test('offers all eight, with the two sets on separate keys', async ({ page }) => {
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error') faults.push(message.text());
    });

    await signIn(page);
    await page.goto(`/companies/${portfolioId}`);

    const group = page.getByRole('group', { name: 'Data entry' });
    await group.getByRole('button', { name: 'Adjustment' }).waitFor();

    expect(await group.getByRole('button').allTextContents()).toEqual(PORTFOLIO_STRIP);
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
      ...PORTFOLIO_STRIP,
    ]);
  });

  test('raises its own money-movement vouchers on the vouchers screen', async ({ page }) => {
    /*
      The screen refused this company outright once, which made its own vouchers unreadable, and
      then offered only a way out to the registry — right while the four it files about a business
      were all it held, wrong the moment it gained a Contra, Payment, Receipt and Journal of its
      own. Those are ordinary vouchers against ordinary accounts and this is where they are raised.
    */
    await signIn(page);
    await page.goto(`/companies/${portfolioId}/vouchers`);

    await expect(page.getByRole('heading', { name: 'Vouchers' })).toBeVisible();
    await expect(page.getByText('This company does not post vouchers')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /New voucher/ })).toBeVisible();
  });

  test('sends only the four it files about a business to the registry', async ({ page }) => {
    await signIn(page);
    const group = page.getByRole('group', { name: 'Data entry' });

    // Waited for the settled list each time: the stand-in draws four before the real eight land,
    // and clicking across that re-render is how this caught the wrong button.
    await page.goto(`/companies/${portfolioId}`);
    await group.getByRole('button', { name: 'Adjustment' }).waitFor();
    await group.getByRole('button', { name: 'Payment' }).click();
    await expect(page).toHaveURL(/vouchers\?new=PAYMENT/);

    await page.goto(`/companies/${portfolioId}`);
    await group.getByRole('button', { name: 'Adjustment' }).waitFor();
    await group.getByRole('button', { name: 'Capital Introduction' }).click();
    await expect(page).toHaveURL(/kg\?raise=CAPITAL_INTRODUCTION/);
  });

  /*
    The whole point of seed v6, followed all the way through rather than only to the right URL.

    A workspace could not file its own money at all before it: no Contra, Payment, Receipt or
    Journal existed for it. Reaching the form is not the same as the entry landing — the four it
    files about a business cannot use that form even in principle, so "it opened" was never
    sufficient evidence that these four could.
  */
  test('files its own money, from the key to a posted voucher', async ({ page }) => {
    await giveThePortfolioItsOwnAccounts();
    const before = (await api(`/companies/${portfolioId}/vouchers?limit=1`)).body?.data?.total ?? 0;

    await signIn(page);
    await page.goto(`/companies/${portfolioId}`);
    await page
      .getByRole('group', { name: 'Data entry' })
      .getByRole('button', { name: 'Adjustment' })
      .waitFor();

    /*
      Retried rather than asserted once. The strip being drawn does not prove the shell has bound
      its keys yet, and a key pressed a moment early is simply swallowed — which is a lost press,
      not a slow one, so no amount of waiting on the first URL would recover it. This failed exactly
      once, on the cold run that first compiled the service worker and took three times as long as
      the rest. Pressing again is what makes the check about whether F5 raises a Payment rather than
      about how busy the machine was.
    */
    await expect(async () => {
      await page.keyboard.press('F5');
      await expect(page).toHaveURL(/vouchers\?new=PAYMENT/, { timeout: 3_000 });
    }).toPass({ timeout: 30_000 });

    const type = page.getByLabel('Voucher type');
    await type.waitFor({ timeout: 20_000 });
    await expect(type).toHaveValue('PAYMENT');

    const accounts = page.locator('table tbody select');
    await accounts.first().selectOption('KG_FEES');
    await accounts.nth(1).selectOption('KG_BANK');
    await page.locator('table tbody input[aria-label^="Debit"]').first().fill('5000');
    await page.locator('table tbody input[aria-label^="Credit"]').nth(1).fill('5000');
    await page.getByRole('button', { name: 'Accept voucher' }).click();

    await expect
      .poll(async () => (await api(`/companies/${portfolioId}/vouchers?limit=1`)).body?.data?.total)
      .toBe(before + 1);

    // And it reaches the books, on the right side of each account.
    const raised = (await api(`/companies/${portfolioId}/vouchers?limit=1`)).body.data.items[0];
    await api(`/companies/${portfolioId}/vouchers/${raised.id}/post`, { method: 'POST' });

    const trial = await api(`/companies/${portfolioId}/reports/trial-balance`);
    const byCode = new Map(
      (trial.body?.data?.rows ?? []).map((row: { code: string }) => [row.code, row]),
    );
    expect(byCode.get('KG_FEES')).toMatchObject({ closingDebit: '5000.00' });
    expect(byCode.get('KG_BANK')).toMatchObject({ closingCredit: '5000.00' });
    expect(trial.body.data.totals.difference).toBe('0.00');
  });

  test('still answers its function keys from the registry screen', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${portfolioId}`);
    await page
      .getByRole('group', { name: 'Data entry' })
      .getByRole('button', { name: 'Business Profit' })
      .waitFor();

    /*
      Ctrl+F7, not F5. A workspace holds Contra, Payment, Receipt and Journal of its own now, and
      those take F4 to F7 — so the four it files about the businesses it tracks moved to the Ctrl
      row rather than lose the keyboard to them. Ctrl+F6 to Ctrl+F9 deliberately: Ctrl+F4 closes the
      tab in Chrome on Windows and Ctrl+F5 is a hard reload.
    */
    await page.keyboard.press('Control+F7');

    await expect(page).toHaveURL(/kg\?raise=BUSINESS_PROFIT/);
  });
});
