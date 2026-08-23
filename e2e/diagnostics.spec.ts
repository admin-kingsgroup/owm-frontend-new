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
 * The parts that only exist when something has gone wrong, and the ones that only exist on a phone.
 *
 * Neither is reachable from the screens spec: a fault has to be raised in a real browser before
 * there is anything to catch or to read, and a stacked table is a layout that only exists below a
 * breakpoint. Both were verified by hand while they were built; this is what keeps them verified.
 */
test.describe('reporting a fault', () => {
  test('an unhandled rejection is filed and reaches the list', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}/reports`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    const message = `e2e rejection ${Date.now()}`;
    await page.evaluate((text) => {
      void Promise.reject(new Error(text));
    }, message);
    await page.waitForTimeout(1_200);

    await page.goto('/reported-errors');
    await expect(page.getByRole('heading', { name: 'Reported errors' })).toBeVisible();
    await expect(page.getByText(message)).toBeVisible();

    // The company it happened in is what makes a report reproducible against the right books.
    const row = page.locator('table tbody tr').filter({ hasText: message });
    await expect(row).toHaveCount(1);
  });

  test('an uncaught throw is filed too — a boundary never sees those', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    const message = `e2e uncaught ${Date.now()}`;
    await page.evaluate((text) => {
      setTimeout(() => {
        throw new Error(text);
      }, 0);
    }, message);
    await page.waitForTimeout(1_200);

    await page.goto('/reported-errors?kind=UNCAUGHT');
    await expect(page.getByText(message)).toBeVisible();
  });

  test('the page survives raising one', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    await page.evaluate(() => {
      void Promise.reject(new Error('e2e: the page must outlive this'));
    });
    await page.waitForTimeout(800);

    // Whatever else a fault does, it must not take the shell with it.
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();
  });
});

test.describe('reading what was reported', () => {
  test('filters by kind and by company, and says so in the URL', async ({ page }) => {
    await signIn(page);
    await page.goto('/reported-errors');
    await expect(page.getByRole('heading', { name: 'Reported errors' })).toBeVisible();

    await page.getByLabel('Filter by kind').selectOption('UNHANDLED_REJECTION');
    await expect(page).toHaveURL(/kind=UNHANDLED_REJECTION/);

    // A filter that is not in the URL cannot be linked at, which is how every other screen works.
    await page.reload();
    await expect(page.getByLabel('Filter by kind')).toHaveValue('UNHANDLED_REJECTION');

    await expect(page.getByLabel('Filter by company')).toBeVisible();
  });

  test('the kind filter actually narrows the list, not just the address', async ({ page }) => {
    /*
      The test above proves the filter reaches the URL and survives a reload. It does not prove the
      list obeys it — a screen that put the parameter in the address and went on showing
      everything would pass it, which is the same way of being wrong as searching a report for a
      heading that is on every report.

      This raises one of each kind and then asks for one of them, so the whole chain is exercised:
      the select, the URL, the query the page sends, the filter the service applies, and the rows
      that come back.
    */
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    const rejection = `filter-check rejection ${Date.now()}`;
    const uncaught = `filter-check uncaught ${Date.now()}`;

    await page.evaluate((text) => {
      void Promise.reject(new Error(text));
    }, rejection);
    await page.evaluate((text) => {
      setTimeout(() => {
        throw new Error(text);
      }, 0);
    }, uncaught);
    await page.waitForTimeout(1_500);

    // Unfiltered: both are there, so anything missing below is the filter and not the reporting.
    await page.goto('/reported-errors');
    await expect(page.getByText(rejection)).toBeVisible();
    await expect(page.getByText(uncaught)).toBeVisible();

    await page.getByLabel('Filter by kind').selectOption('UNHANDLED_REJECTION');
    await expect(page.getByText(rejection)).toBeVisible();
    await expect(page.getByText(uncaught), 'the other kind survived the filter').toHaveCount(0);

    await page.getByLabel('Filter by kind').selectOption('UNCAUGHT');
    await expect(page.getByText(uncaught)).toBeVisible();
    await expect(page.getByText(rejection), 'the other kind survived the filter').toHaveCount(0);
  });

  test('the button bar clears them, from the keyboard', async ({ page }) => {
    await signIn(page);
    await page.goto('/reported-errors?kind=RENDER');
    await expect(page.getByRole('heading', { name: 'Reported errors' })).toBeVisible();

    await expect(page.getByRole('button', { name: /Clear filters/ })).toBeVisible();
    await page.keyboard.press('Alt+KeyA');

    await expect(page).not.toHaveURL(/kind=/);
  });

  test('a failed request is not reported as a closed door', async ({ page }) => {
    /*
      The screen used to render one refusal for every failure, so a dropped connection or a 500
      told an administrator the list was not theirs to read — which sends somebody to ask for
      permission they already hold, and offers "back to the companies" as the only way on.
    */
    await signIn(page);
    await page.route('**/client-errors*', (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'The database is unavailable' }),
      });
    });

    await page.goto('/reported-errors');

    await expect(page.getByText(/Could not load reported errors/i)).toBeVisible();
    await expect(page.getByText(/not yours to read/i)).toHaveCount(0);
    // A failure is worth retrying; being turned away is not.
    await expect(page.getByRole('button', { name: /Try again/i })).toBeVisible();
  });

  test('turns away somebody who may not read them, and says only that', async ({ page }) => {
    // A plain account: created by the administrator, because registration is closed otherwise.
    const email = `plain-${Date.now()}@owm.local`;
    const api = process.env.VITE_API_BASE_URL ?? 'http://localhost:5099/api/v1';
    await fetch(`${api}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: 'Plain Reader', email, password: 'plain-pass-1234' }),
    });
    const login = await fetch(`${api}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'plain-pass-1234' }),
    });
    const plainToken = (await login.json()).data.accessToken;

    await page.addInitScript((value) => {
      window.localStorage.setItem('owm_access_token', value);
    }, plainToken);
    await page.goto('/reported-errors');

    await expect(page.getByText(/not yours to read/i)).toBeVisible();
    // The screen's own heading above a refusal reads like a fault rather than a closed door.
    await expect(page.getByText(/Faults the app reported/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Back to the companies/i })).toBeVisible();
  });
});

/**
 * The v4 masters, seen rather than asserted.
 *
 * The backend suite proves an Income voucher posts and reaches the Profit & Loss. None of that
 * says a person can find it: a voucher type nobody can reach from the menu is a numbering series
 * for documents that will never be raised.
 */
test.describe('the household voucher types', () => {
  test('Income and Expense are on the Transactions menu, with the rest', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await page.getByRole('button', { name: 'Transactions' }).click();

    /*
      Waited for before the list is read. The shell loads the company's voucher types after it
      first paints, so the menu opens holding only the fixed entries and fills in a moment later —
      reading it immediately catches it half-built and reports the product broken.
    */
    await expect(page.getByRole('menuitem').filter({ hasText: 'Income' })).toBeVisible();

    /*
      Read as a list rather than probed one at a time: a keyed type renders its shortcut inside the
      accessible name — "Contra F4" — so an exact match on the label alone finds nothing and would
      report the product broken when it is the selector that is wrong.
    */
    const items = (await page.getByRole('menuitem').allInnerTexts()).map((text) =>
      text.replace(/\s+/g, ' ').trim(),
    );

    for (const name of ['Income', 'Expense', 'Receipt', 'Payment', 'Contra', 'Journal']) {
      expect(
        items.some((item) => item === name || item.startsWith(`${name} `)),
        `${name} is missing from Transactions — saw ${JSON.stringify(items)}`,
      ).toBe(true);
    }

    // A household trades with nobody, so these must not be offered at all.
    for (const name of ['Sales', 'Purchase', 'Credit Note', 'Debit Note']) {
      expect(
        items.some((item) => item === name || item.startsWith(`${name} `)),
        `${name} is offered on a personal book`,
      ).toBe(false);
    }
  });

  test('the Income menu item opens the form it points at', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await page.getByRole('button', { name: 'Transactions' }).click();
    /*
      Matched on the label rather than the whole name: a type with a function key renders the key
      inside its accessible name, so this is "Income F8" and an exact match on "Income" waits for
      something that will never appear. It found that out the hard way when F8 was bound.
    */
    await page.getByRole('menuitem', { name: 'Income' }).click();

    await expect(page).toHaveURL(/new=INCOME/);
    await expect(page.getByRole('dialog')).toBeVisible();
    // The form has to say which kind of document it is raising, or every voucher looks the same.
    await expect(page.getByRole('dialog')).toContainText(/Income/);
  });

  test('the button bar offers only documents these books can hold', async ({ page }) => {
    /*
      The bar used to draw all eight of Tally's keys whatever the company was, so a personal book
      offered Sales, Purchase, Credit Note and Debit Note — four documents it cannot raise — and
      hid Income and Expense, which it can. Pressing one did not even fail: the vouchers screen
      falls back to the first active type, so it opened the wrong kind of document without saying
      so, which is the failure mode worth a test.
    */
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const bar = await page.evaluate(() =>
      [...document.querySelectorAll('button')]
        .map((button) => (button.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((text) =>
          /^(Sales|Purchase|Credit Note|Debit Note|Income|Expense|Contra|Payment|Receipt|Journal)/.test(
            text,
          ),
        ),
    );

    // Tally's own keys, and the same two keys carrying earning and spending where there is no trade.
    expect(bar).toEqual([
      'ContraF4',
      'PaymentF5',
      'ReceiptF6',
      'JournalF7',
      'IncomeF8',
      'ExpenseF9',
    ]);
  });

  test('keeps a way in when the voucher types cannot be read', async ({ page }) => {
    /*
      The shell asks for the company's types once and treats the answer as chrome — a failure is
      swallowed and the hook returns an empty list, exactly as it does while the request is still
      in flight. Filtering the bar on that list alone therefore emptied it whenever the request did
      not come back, leaving no way to raise a voucher at all: a regression introduced by the fix
      for the phantom buttons, and invisible unless the failure is forced.

      Contra, Payment, Receipt and Journal are seeded for every posting company, so they stand in.
      Income and Expense do not, because whether they exist is the thing that is not known.
    */
    await signIn(page);
    await page.route('**/voucher-types*', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, message: 'The database is unavailable' }),
      }),
    );

    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    const entry = page.getByRole('button', { name: /^(Contra|Payment|Receipt|Journal)/ });
    await expect(entry.first(), 'no way to enter a voucher at all').toBeVisible();
    expect(await entry.count()).toBe(4);

    // Not these: whether the company has them is precisely what could not be read.
    await expect(page.getByRole('button', { name: /^(Income|Expense|Sales|Purchase)/ })).toHaveCount(
      0,
    );
  });

  test('each type gets a register of its own', async ({ page }) => {
    /*
      Registers are listed per voucher type, so adding two types adds two registers. This is the
      half that would silently not happen if the type existed only in the seed.
    */
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await page.getByRole('button', { name: 'Reports' }).click();

    // Auto-retrying, for the same reason as above: the registers are built from the voucher types,
    // so they are the last part of this menu to exist.
    const registers = page.getByRole('menuitem').filter({ hasText: /Register/i });
    await expect(registers.first(), 'no register is listed for any voucher type').toBeVisible();

    /*
      One per type that can carry documents. Journal and Contra are registers too in Tally, so the
      count is not asserted exactly — what matters is that adding a voucher type added a register,
      which is the half that would silently not happen if the type existed only in the seed.
    */
    expect(await registers.count()).toBeGreaterThan(1);
  });
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  const NARROW = [
    { name: 'companies', path: () => '/companies' },
    { name: 'masters', path: () => `/companies/${companyId}?tab=accounts` },
    { name: 'day-book', path: () => `/companies/${companyId}/reports?report=day-book` },
    { name: 'reported-errors', path: () => '/reported-errors' },
  ];

  for (const screen of NARROW) {
    test(`${screen.name} fits, with nothing out of reach`, async ({ page }) => {
      await signIn(page);
      await page.goto(screen.path());
      await page.waitForLoadState('networkidle');
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, 'the page must never scroll sideways').toBeLessThanOrEqual(1);

      /*
        Overflowing is only half of it. A row wider than the screen is fine if something scrolls it;
        it is a defect when nothing does, because then the end of every row is simply gone.
        */
      const stranded = await page.evaluate(() => {
        const viewport = document.documentElement.clientWidth;
        const out: string[] = [];

        for (const element of document.querySelectorAll('main *, header *')) {
          const box = element.getBoundingClientRect();
          if (box.width === 0 || box.height === 0 || box.right <= viewport + 1) continue;

          let parent = element.parentElement;
          let scrollable = false;
          while (parent) {
            const overflowX = getComputedStyle(parent).overflowX;
            if (
              (overflowX === 'auto' || overflowX === 'scroll') &&
              parent.scrollWidth > parent.clientWidth + 1
            ) {
              scrollable = true;
              break;
            }
            parent = parent.parentElement;
          }

          if (!scrollable) out.push(String(element.className).split(' ')[0] || element.tagName);
        }

        return [...new Set(out)];
      });
      expect(stranded, 'nothing may sit past the edge with no way to scroll to it').toEqual([]);

      // 44px is the figure both platform guidelines land on for a target under a thumb.
      const small = await page.evaluate(() =>
        [
          ...document.querySelectorAll(
            'button, select, input:not([type=checkbox]):not([type=radio])',
          ),
        ]
          .map((control) => {
            const box = control.getBoundingClientRect();
            return {
              what: control.getAttribute('aria-label') || control.textContent?.trim().slice(0, 24),
              height: Math.round(box.height),
            };
          })
          .filter((control) => control.height > 0 && control.height < 44),
      );
      expect(small, 'every control needs a thumb-sized target').toEqual([]);

      /*
        Last, and deliberately so: a fullPage capture resizes the emulated viewport while it works,
        and anything measured straight afterwards is measured mid-resize — which reads as controls
        that shrank and a layout that moved.
      */
      await page.screenshot({ path: `e2e/screenshots/phone-${screen.name}.png`, fullPage: true });
    });
  }

  test('a record list becomes labelled cards rather than a sideways scroll', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}?tab=accounts`);
    await page.waitForLoadState('networkidle');

    const table = page.locator('table[data-stack]').first();
    await expect(table).toBeVisible();

    // The header row is dropped because each cell carries its own column name from here on.
    await expect(table.locator('thead')).toBeHidden();
    const label = await table
      .locator('tbody td[data-label]')
      .first()
      .evaluate((cell) => getComputedStyle(cell, '::before').content);
    expect(label, 'a stacked cell has to say which field it is').not.toBe('none');
  });
});
