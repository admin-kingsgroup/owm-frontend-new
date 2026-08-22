import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed, seedFeatured } from './seed';

let companyId: string;
let token: string;
/** A company with bill-wise and multi-currency on — see seedFeatured. */
let featuredId: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
  featuredId = await seedFeatured(token);
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
  // The three the server had always answered and nothing asked for until this direction was built.
  { name: 'reports-cash-book', path: () => `/companies/${companyId}/reports?report=cash-book` },
  { name: 'reports-bank-book', path: () => `/companies/${companyId}/reports?report=bank-book` },
  {
    name: 'reports-group-summary',
    path: () => `/companies/${companyId}/reports?report=group-summary`,
  },
  { name: 'reports-day-book', path: () => `/companies/${companyId}/reports?report=day-book` },
  { name: 'vouchers', path: () => `/companies/${companyId}/vouchers` },
  { name: 'voucher-entry', path: () => `/companies/${companyId}/vouchers?new=CONTRA` },
  { name: 'masters', path: () => `/companies/${companyId}?tab=accounts` },
  { name: 'import-export', path: () => `/companies/${companyId}?tab=import-export` },

  /*
    The three that only exist behind a company feature. Drawn against the company that has those
    features on, because against the plain one the page falls back to the balance sheet and the
    check would pass while proving nothing.
  */
  {
    name: 'reports-receivables',
    path: () => `/companies/${featuredId}/reports?report=receivables`,
  },
  { name: 'reports-payables', path: () => `/companies/${featuredId}/reports?report=payables` },
  { name: 'reports-forex', path: () => `/companies/${featuredId}/reports?report=forex` },
  { name: 'shortcuts', path: () => `/companies/${companyId}?help=shortcuts` },
];

/**
 * Browser-level failures that say something about the network rather than about the code.
 *
 * `ERR_NETWORK_CHANGED` failed a run on a laptop that switched access point mid-suite; the other
 * two are the same event under different names.
 */
const IGNORED_TRANSPORT =
  /net::(ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_IO_SUSPENDED)/;

test.describe('every screen, drawn', () => {
  for (const screen of SCREENS) {
    test(`${screen.name} draws without overflowing or erroring`, async ({ page }) => {
      const faults: string[] = [];
      page.on('pageerror', (error) => faults.push(`uncaught: ${error.message}`));
      page.on('console', (message) => {
        if (message.type() !== 'error') return;
        // The machine's network moving is not the application misbehaving, and a run that fails
        // for it teaches everyone to ignore this check. Only the codes that mean exactly that are
        // dropped — a refused connection or a 500 still counts, because those are ours.
        if (IGNORED_TRANSPORT.test(message.text())) return;
        faults.push(`console: ${message.text()}`);
      });

      await signIn(page);
      await page.goto(screen.path());
      // The frame is on every screen; waiting for it means waiting for the app, not for a spinner.
      await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();
      await page.waitForLoadState('networkidle');

      /*
        Measured before any picture is taken. A fullPage screenshot resizes the emulated viewport
        while it works, so a width read straight afterwards is read mid-resize and reports an
        overflow that is not there.

        The page must never scroll sideways. A statement is wide and a voucher grid is wider, and
        the failure mode is always the same: one column pushes the document past the viewport and
        the figures at the end of every row become unreachable.
      */
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen.name} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

      expect(faults, `${screen.name} reported ${faults.length} fault(s)`).toEqual([]);

      // The readable record, for someone reviewing what a change did.
      await page.screenshot({ path: `e2e/screenshots/${screen.name}.png`, fullPage: true });

      /*
        And the same picture compared against the last one accepted, so a change that moves
        something nobody was looking at fails here rather than reaching the user.

        The status strip is masked: it carries today's date, which would otherwise make every
        baseline stale overnight. The financial year is not masked — it changes once a year, and a
        baseline that needs refreshing each January is a fair price for seeing the year at all.
      */
      await expect(page).toHaveScreenshot(`${screen.name}.png`, {
        fullPage: true,
        mask: [page.locator('[data-print="hide"]')],
        maxDiffPixelRatio: 0.01,
      });
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

  /**
   * Every report the menu offers has to open on something. A menu item pointing at a report the
   * page does not know how to draw falls back to the balance sheet silently — the heading would be
   * the only clue, and only to someone who noticed it had not changed.
   */
  test('opens every report the menu lists, on the report it names', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();

    await page.getByRole('button', { name: 'Reports' }).click();
    const items = await page.getByRole('menuitem').all();
    const reports: Array<{ id: string; href: string }> = [];
    for (const item of items) {
      const href = (await item.getAttribute('href')) ?? '';
      const id = /[?&]report=([^&]+)/.exec(href)?.[1];
      if (!id) continue;
      reports.push({ id, href });
    }
    expect(reports.length, 'the Reports menu is empty').toBeGreaterThan(8);

    /*
      Against the id in the link, not the menu's wording. A menu entry is allowed to phrase the job
      — "Verify books — trial balance" — while the page names the artefact it produced, "Trial
      Balance"; asserting those two are the same string was asserting something the product never
      claimed, and it failed on the first entry written that way.

      What must hold is what this was written for: every link opens the report it points at. A page
      that quietly falls back to whichever report it had open shows up here as one heading serving
      several ids, and as an id that does not survive the navigation.
    */
    const headings = new Map<string, string>();
    for (const report of reports) {
      await page.goto(report.href);
      const heading = (await page.getByRole('heading', { level: 1 }).textContent())?.trim() ?? '';

      expect(heading, `${report.id} opened with no heading`).not.toBe('');
      expect(page.url(), `${report.id} did not survive the navigation`).toContain(
        `report=${report.id}`,
      );
      /*
        Only a *different* report sharing a heading is a fallback. One report legitimately appears
        several times over: the registers are listed per voucher type, so `report=register` is on
        the menu once for each of them, and every one of those is correctly headed "Register".
      */
      const claimed = headings.get(heading);
      expect(
        claimed === undefined || claimed === report.id,
        `${report.id} and ${claimed} both opened "${heading}" — one of them fell back`,
      ).toBe(true);

      headings.set(heading, report.id);
    }
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
