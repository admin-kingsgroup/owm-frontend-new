import { test, expect } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

import { seed, seedFeatured, seedAnalytics } from './seed';

let companyId: string;
let token: string;
/** A company with bill-wise and multi-currency on — see seedFeatured. */
let featuredId: string;
/** An analytics workspace, which gets an entirely different dashboard — see seedAnalytics. */
let analyticsId: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
  featuredId = await seedFeatured(token);
  analyticsId = await seedAnalytics(token);
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

  /*
    The dashboard is the screen entering a company lands on, and it draws differently for each kind
    of company. The plain one above covers the common case; these two cover the halves of it that
    the common case cannot show — the ageing and currency cards, which only exist behind a feature,
    and the portfolio dashboard, which is a different screen entirely.
  */
  { name: 'dashboard-featured', path: () => `/companies/${featuredId}` },
  { name: 'dashboard-portfolio', path: () => `/companies/${analyticsId}` },
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
      /*
        Help, not Reports.

        The frame is on every screen, and waiting for it means waiting for the app rather than for a
        spinner — but it has to be waited on through something every screen actually has. Reports is
        no longer that: an analytics workspace keeps no books, so it is not offered statements, and
        this wait timed out on the one screen in the sweep that has none. Worse, it did so only
        sometimes — the menu is drawn while the company's type is still unknown and withdrawn once
        it arrives, so the wait was racing the company list. Help is on the bar whatever the company
        turns out to be.
      */
      await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
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

  /*
    The ageing on this screen moves every day a bill goes unpaid, and roughly four times a year one
    crosses a band and a five-figure sum jumps from one bucket to the next. The visual check has a
    one percent pixel tolerance, so it absorbs that quietly — which means it is not what is holding
    these figures up, and something has to be.

    These two invariants hold whatever today's date is: the bands are a partition of the same bills
    the table lists, so they must add up to the total; and a bill's outstanding is what is left of
    it after what has been settled. Either one breaking is a real fault in the report rather than
    the calendar moving.
  */
  test('adds up: the ageing bands total the bills, and each bill nets off its settlement', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${featuredId}/reports?report=receivables`);
    await expect(page.getByRole('heading', { name: 'Receivables' })).toBeVisible();

    // Read the way a person reads them, so this checks the screen rather than the API behind it.
    const amount = (text: string | null) => Number((text ?? '').replace(/[^0-9.-]/g, ''));

    const total = amount(await page.locator('[class*="bucketTotal"]').first().textContent());
    expect(total, 'the total is missing or zero').toBeGreaterThan(0);

    /*
      The figures themselves, not the tiles around them. Matching the tile swept up the element that
      wraps all of them, whose text is every band run together — which parses to nothing and reads
      as though the report were broken when it was the selector.
    */
    const figures = await page.locator('[class*="bucketAmount"]').allTextContents();
    expect(figures.length, 'the ageing bands are missing').toBeGreaterThan(1);

    // The last is the total tile, which is what the bands are being checked against.
    const banded = figures.slice(0, -1).reduce((sum, figure) => sum + amount(figure), 0);
    expect(banded, 'the ageing bands do not add up to the total').toBeCloseTo(total, 2);

    const rows = page.locator('tbody tr');
    const count = await rows.count();
    expect(count, 'no bills to check').toBeGreaterThan(0);

    /*
      A foreign bill carries a second figure in the same cell — the amount in the currency it was
      invoiced in, under the base one. Read whole, the cell reads as one impossible number, so the
      foreign line is taken back off before the base figure is parsed. These sums are in the base
      currency, which is what the bands and the total are built from.
    */
    const baseAmount = async (cell: Locator) => {
      let text = (await cell.textContent()) ?? '';
      for (const foreign of await cell.locator('[class*="foreign"]').allTextContents()) {
        text = text.replace(foreign, '');
      }
      return amount(text);
    };

    let outstanding = 0;
    for (let index = 0; index < count; index += 1) {
      const cells = rows.nth(index).locator('td');
      const billed = await baseAmount(cells.nth(3));
      const settled = await baseAmount(cells.nth(4));
      const left = await baseAmount(cells.nth(5));

      expect(left, `bill ${index + 1} does not net off what was settled`).toBeCloseTo(
        billed - settled,
        2,
      );
      outstanding += left;
    }

    expect(outstanding, 'the bills do not add up to the total').toBeCloseTo(total, 2);
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

  /*
    The balances on the gateway are the one place a reader meets a figure they might want to
    question. Every other number in the product opens the working behind it; these did not, and the
    reader had to go and find the report themselves.
  */

  /*
    The same screen with the dark theme chosen.

    Nothing here had ever been drawn dark, though the checks are meant to cover "layout, theme, and
    the shell". Every colour on this page comes from a token and both themes define every token, so
    the two should differ only in palette — which is exactly the sort of claim that stays true until
    one rule hardcodes a colour and only one theme notices.

    The gateway rather than a statement because it carries the most kinds of surface at once: the
    menu bar, the context strip, two panels, a table with its own hover, and the status strip.
  */

  /*
    An actual import, against the actual API.

    The panel has unit tests, but every one of them answers the entity layer from a mock — so what
    they prove is that the panel calls the right function, not that the call is one the server
    accepts. The parts most likely to be wrong live exactly there: whether a code that exists is
    found and patched rather than refused, whether the fields sent survive validation, and whether
    a group whose parent is further down the same file is created at all.

    Written as one test rather than three because each step depends on the last: the group has to
    exist before a ledger can name it, and the ledger has to exist before re-importing it can
    update rather than create.
  */

  /*
    Moving from one company's books to another's.

    The screen holds what it last loaded while it refreshes, so that a panel reporting on something
    it just did is not swept away by the reload it triggered. That is right for a refresh and wrong
    for a change of company: held across a switch it would show one company's figures under the
    other's name, for as long as the load takes.

    So this asks for the plain company, moves to the featured one, and requires that nothing of the
    first is still on screen once the second has arrived — the codes are what tell them apart, and
    they appear in the frame as well as on the page.
  */
  /*
    The columns the export writes, read back in full.

    The import check above sends the three columns a file must have. The export writes twelve — the
    party's tax registration, address, email and telephone among them — and a file with all of them
    is what an edited export actually is. Nothing had put one back in, so the five party columns
    were written out and never read.

    Sent twice: once to set them on an account that has none, and once with two of the twelve
    columns removed, because leaving a column out has to leave that field alone rather than clear
    it. That distinction is the whole reason absent and empty are held apart.
  */
  test('reads back every column the export writes, and leaves out what the file leaves out', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}?tab=import-export`);
    await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();

    const chooseLedgers = page.locator('label', { hasText: 'Ledgers CSV' }).locator('input');
    const columns =
      'code,name,accountGroupCode,ledgerType,openingBalance,openingBalanceType,maintainBillwise,gstin,pan,address,contactEmail,contactPhone';

    await chooseLedgers.setInputFiles({
      name: 'ledgers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        `${columns}\n` +
          'E2E_PARTY,Tenant of the shop,CURRENT_ASSETS,GENERAL,0,DEBIT,false,' +
          '27ABCDE1234F1Z5,ABCDE1234F,"12 Example Road, Mumbai 400001",tenant@example.invalid,+91 90000 11111\n',
      ),
    });
    await expect(page.getByText('1 created')).toBeVisible();

    /*
      Read back from the server rather than off a screen. No screen shows all twelve at once, and
      what is being checked is that the columns were sent and accepted — the panel's own tally would
      say "1 created" whether or not the party details went with it.
    */
    const read = async () => {
      const response = await page.request.get(
        `http://localhost:5099/api/v1/companies/${companyId}/ledgers?limit=200`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      const body = await response.json();
      const rows = body.data.items ?? body.data;
      return rows.find((row: { code: string }) => row.code === 'E2E_PARTY');
    };

    const created = await read();
    expect(created, 'the imported account is not in the chart').toBeTruthy();
    expect(created.name).toBe('Tenant of the shop');
    expect(created.gstin).toBe('27ABCDE1234F1Z5');
    expect(created.pan).toBe('ABCDE1234F');
    expect(created.address).toBe('12 Example Road, Mumbai 400001');
    expect(created.contactEmail).toBe('tenant@example.invalid');
    expect(created.contactPhone).toBe('+91 90000 11111');

    /*
      The same account again with the tax columns dropped and the name changed. The name must move
      and the registration must not — a three-column correction corrects three columns.
    */
    await page.goto(`/companies/${companyId}?tab=import-export`);
    await page
      .locator('label', { hasText: 'Ledgers CSV' })
      .locator('input')
      .setInputFiles({
        name: 'ledgers.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'code,name,accountGroupCode\nE2E_PARTY,Tenant of the corner shop,CURRENT_ASSETS\n',
        ),
      });
    await expect(page.getByText('1 updated')).toBeVisible();

    const updated = await read();
    expect(updated.name, 'the column that was there did not move').toBe(
      'Tenant of the corner shop',
    );
    expect(updated.gstin, 'a column the file left out was cleared').toBe('27ABCDE1234F1Z5');
    expect(updated.address, 'a column the file left out was cleared').toBe(
      '12 Example Road, Mumbai 400001',
    );
  });

  test('shows the company asked for, and nothing of the one being left', async ({ page }) => {
    await signIn(page);

    await page.goto(`/companies/${companyId}`);
    await expect(page.getByText('SHOT01').first()).toBeVisible();

    /*
      Through the switcher rather than by address. Typing an address reloads the page, which throws
      the held screen away for free and so proves nothing; the switcher moves within the running
      application, which is where holding it would show.
    */
    await page.getByRole('button', { name: /SHOT01/ }).click();
    await page
      .getByRole('menu', { name: 'Switch company' })
      .getByRole('menuitem', { name: /ADB - Multi/ })
      .click();

    await expect(page.getByText('SHOT02').first()).toBeVisible();
    await expect(page.getByText('SHOT01')).toHaveCount(0);
  });

  test('imports a chart through the screen, creating what is new and correcting what is not', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}?tab=import-export`);
    await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();

    const chooseGroups = page.locator('label', { hasText: 'Account groups CSV' }).locator('input');
    const chooseLedgers = page.locator('label', { hasText: 'Ledgers CSV' }).locator('input');

    /*
      The child is written above its parent on purpose. A file exported from another product
      frequently is, and sent in the order written the child is refused for a parent that is about
      to exist one line later.
    */
    await chooseGroups.setInputFiles({
      name: 'groups.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        [
          'code,name,parentCode,nature,groupType',
          'E2E_CHILD,Imported Child,E2E_PARENT,ASSET,BALANCE_SHEET',
          'E2E_PARENT,Imported Parent,,ASSET,BALANCE_SHEET',
          '',
        ].join('\n'),
      ),
    });
    await expect(page.getByText('2 created')).toBeVisible();

    // A new account under the group just imported, so the two halves are checked against each other.
    await chooseLedgers.setInputFiles({
      name: 'ledgers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('code,name,accountGroupCode\nE2E_LEDGER,Imported Account,E2E_CHILD\n'),
    });
    await expect(page.getByText('1 created')).toBeVisible();

    /*
      The same file again with the name changed. Every row is a duplicate, which is what an edited
      export is — and refusing those was the fault this screen was rebuilt to fix.
    */
    await chooseLedgers.setInputFiles({
      name: 'ledgers.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'code,name,accountGroupCode\nE2E_LEDGER,Imported Account renamed,E2E_CHILD\n',
      ),
    });
    await expect(page.getByText('1 updated')).toBeVisible();

    // And it reached the books, not just the panel's own tally.
    await page.goto(`/companies/${companyId}?tab=accounts`);
    await expect(page.getByText('Imported Account renamed')).toBeVisible();
  });

  /*
    An export read straight back in, with the optional columns empty.

    This is the journey the panel exists for and the one the unit suite cannot prove: those tests
    mock the two API calls, so they see what the screen sends and never what the server makes of
    it — and what the server made of it was the defect. An empty cell went up as `''`, which to a
    validator expecting a fifteen-character GSTIN is not "no GSTIN" but a GSTIN that fails.

    It bit hardest here of anywhere. These books carry no tax layer, so GSTIN and PAN are empty on
    every account of every one of them; the round trip did not degrade at the edges, it refused
    every row it was given.
  */
  test('reads back a file whose optional columns are empty, clearing them rather than refusing', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}?tab=import-export`);
    await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();

    await page
      .locator('label', { hasText: 'Ledgers CSV' })
      .locator('input')
      .setInputFiles({
        name: 'ledgers.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'code,name,accountGroupCode,gstin,pan,contactEmail,contactPhone\n' +
            'HDFC_BANK,HDFC Bank — 4021,BANK_ACCOUNTS,,,,\n',
        ),
      });

    // Accepted by the real server, which is the only place the empty cell was ever refused.
    await expect(page.getByText('1 updated')).toBeVisible();
    await expect(page.getByText(/not a valid/)).toHaveCount(0);
  });

  /*
    Currency is the one added column that cannot be set in bulk any other way, and it is what every
    voucher line posted against the account inherits. Run against the multi-currency company,
    because that is the only kind that has a second currency to name.
  */
  test('carries a ledger currency in, on a company that keeps more than one', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${featuredId}?tab=import-export`);
    await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();

    await page
      .locator('label', { hasText: 'Ledgers CSV' })
      .locator('input')
      .setInputFiles({
        name: 'ledgers.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'code,name,accountGroupCode,currencyCode,creditDays\n' +
            'TENANT,Tenant — Bandra flat,LOANS_ADVANCES_ASSET,usd,45\n',
        ),
      });
    await expect(page.getByText('1 updated')).toBeVisible();

    const response = await page.request.get(
      `http://localhost:5099/api/v1/companies/${featuredId}/ledgers?limit=200`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const body = await response.json();
    const rows = body.data.items ?? body.data;
    const tenant = rows.find((row: { code: string }) => row.code === 'TENANT');

    // Read off the server, which is the only place it counts.
    expect(tenant?.currencyId, 'the currency did not reach the account').toBeTruthy();
    expect(tenant?.creditDays).toBe(45);
  });

  /*
    Left to `Number()` this became NaN, JSON wrote it as null, and the server read that as a
    request to clear the field — a typo quietly wiping a credit limit.
  */
  test('fails a row whose number column is not a number, rather than clearing it', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}?tab=import-export`);
    await expect(page.getByRole('heading', { name: 'Import' })).toBeVisible();

    await page
      .locator('label', { hasText: 'Ledgers CSV' })
      .locator('input')
      .setInputFiles({
        name: 'ledgers.csv',
        mimeType: 'text/csv',
        buffer: Buffer.from(
          'code,name,accountGroupCode,creditLimit\n' +
            'HDFC_BANK,HDFC Bank — 4021,BANK_ACCOUNTS,fifty thousand\n',
        ),
      });

    await expect(page.getByText(/creditLimit is not a number/)).toBeVisible();
  });

  test('the gateway reads in the dark theme too', async ({ page }) => {
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(error.message));

    await signIn(page);
    // Stamped before the first paint, the same way the app's own pre-paint script does it.
    await page.addInitScript(() => window.localStorage.setItem('owm.theme', 'dark'));
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Reports' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    // The balances are still balances, and still open the working behind them.
    await expect(page.getByRole('link', { name: 'Current Assets' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `the dark gateway scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

    expect(faults, `the dark gateway reported ${faults.length} fault(s)`).toEqual([]);

    await expect(page).toHaveScreenshot('gateway-dark.png', {
      fullPage: true,
      mask: [page.locator('[data-print="hide"]')],
      maxDiffPixelRatio: 0.01,
    });
  });

  /*
    An empty report behind a company feature has two quite different causes, and they must not read
    alike: everything is settled, or the company does not keep books that way at all. Told "nothing
    outstanding", somebody whose books are full of unpaid invoices would believe it.

    Reached by address, because the menu leaves these out of a company without the feature — so the
    only reader who arrives here is the one who needs telling. They used to be bounced to the
    balance sheet instead, which answered a question nobody had asked.
  */
  test('says why a report behind a feature is empty, and where to switch it on', async ({
    page,
  }) => {
    await signIn(page);

    /*
      Nothing may be logged while it happens. The server answers these reports empty rather than
      refusing them, and a screen that asked anyway would put a failure in front of a reader who
      only followed a link.
    */
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !IGNORED_TRANSPORT.test(message.text())) {
        faults.push(message.text());
      }
    });

    await page.goto(`/companies/${companyId}/reports?report=receivables`);
    await expect(page.getByRole('heading', { name: 'Receivables' })).toBeVisible();
    await expect(page.getByText(/not kept bill by bill/)).toBeVisible();
    await expect(page.getByRole('link', { name: /company's settings/ })).toHaveAttribute(
      'href',
      `/companies/${companyId}?tab=settings`,
    );

    await page.goto(`/companies/${companyId}/reports?report=forex`);
    await expect(page.getByRole('heading', { name: 'Forex Gain/Loss' })).toBeVisible();
    await expect(page.getByText(/kept in one currency/)).toBeVisible();

    // And the company that does keep bills says nothing of the sort.
    await page.goto(`/companies/${featuredId}/reports?report=receivables`);
    await expect(page.getByRole('heading', { name: 'Receivables' })).toBeVisible();
    await expect(page.getByText(/not kept bill by bill/)).toHaveCount(0);

    await page.waitForLoadState('networkidle');
    expect(faults, `opening these reported ${faults.length} fault(s)`).toEqual([]);
  });

  test('opens the working behind a balance on the gateway', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);

    const row = page.getByRole('link', { name: 'Current Assets' });
    await expect(row).toBeVisible();
    await row.click();

    await expect(page).toHaveURL(/report=monthly-summary/);
    await expect(page).toHaveURL(/groupId=/);
    await expect(page.getByRole('heading', { name: 'Monthly Summary' })).toBeVisible();

    /*
      And on the group that was clicked, with figures under it. A link that opens the right report
      about the wrong subject — or about the right one with nothing in it — passes a heading check
      and fails the reader, which is the whole fault this link was added to fix.
    */
    // The report's own title, not the picker above it — the picker holds the same words in an
    // option, which is never visible and matched first.
    await expect(page.getByRole('heading', { level: 2, name: /Current Assets/ })).toBeVisible();
    await expect(page.locator('tbody tr')).not.toHaveCount(0);
  });

  /*
    What a statement looks like on paper.

    The print rules are substantial — tabs and toolbars removed, colour forced to black, the tree put
    back inline — and nothing had ever exercised them. They are also where a screen convention
    quietly becomes a printing fault: the dotted rule under a ledger name says the account behind it
    can be opened, which is true on a screen and meaningless on a page somebody is holding.
  */
  test('prints a statement without the marks that only mean something on screen', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}/reports?report=trial-balance`);
    await expect(page.getByRole('heading', { name: 'Trial Balance' })).toBeVisible();

    const ledgerName = page.locator('tbody button').first();
    await expect(ledgerName).toBeVisible();

    // On screen the name carries a rule, which is what says it opens the account behind it.
    await expect(ledgerName).toHaveCSS('text-decoration-style', 'dotted');

    await page.emulateMedia({ media: 'print' });

    await expect(ledgerName).toHaveCSS('text-decoration-line', 'none');
    // And a control that cannot be pressed on paper is not on it.
    await expect(page.getByRole('button', { name: /Nil balances/ })).toBeHidden();
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
