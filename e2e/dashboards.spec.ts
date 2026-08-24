import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { ACCOUNT, seed, seedAnalytics, seedFeatured } from './seed';

let companyId: string;
let token: string;
/** An analytics workspace, which gets an entirely different dashboard — see seedAnalytics. */
let analyticsId: string;
/** A company with bill-wise and multi-currency on — see seedFeatured. */
let featuredId: string;

test.beforeAll(async () => {
  ({ companyId, token } = await seed());
  featuredId = await seedFeatured(token);
  analyticsId = await seedAnalytics(token);
});

/** Straight into a signed-in session, for the checks that are not about signing in. */
async function signIn(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
}

/**
 * Browser-level failures that say something about the network rather than about the code — the
 * same set the screen sweep ignores, and for the same reason.
 */
const IGNORED_TRANSPORT =
  /net::(ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_IO_SUSPENDED)/;

/**
 * The way in: sign in, choose a company, land on its dashboard.
 *
 * Every other check in this suite starts by putting a token into storage, which is quicker and is
 * the right trade for a check about a screen. It means none of them has ever pressed the button
 * this application opens on. The three steps below are the promise the product makes about its own
 * front door, and each of them was reasoned about rather than watched.
 */
test.describe('signing in', () => {
  test('lands on the company list, and a company opens on its dashboard', async ({ page }) => {
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(`uncaught: ${error.message}`));
    page.on('console', (message) => {
      if (message.type() !== 'error') return;
      if (IGNORED_TRANSPORT.test(message.text())) return;
      faults.push(`console: ${message.text()}`);
    });

    await page.goto('/');

    // Named rather than placeheld — the form carries aria-labels, which is what this finds them by.
    await page.getByLabel('Email').fill(ACCOUNT.email);
    await page.getByLabel('Password').fill(ACCOUNT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Company selection, not a company. Which set of books is a decision, and it is made here.
    await expect(page).toHaveURL(/\/companies$/);
    await expect(page.getByRole('heading', { name: 'Companies', level: 1 })).toBeVisible();

    await page.getByRole('link', { name: 'Open ADB - INR' }).click();

    // And the company opens on its dashboard, not on its settings.
    await expect(page).toHaveURL(new RegExp(`/companies/${companyId}$`));
    await expect(page.getByRole('heading', { name: 'ADB - INR', level: 1 })).toBeVisible();
    await expect(page.getByText('Company dashboard')).toBeVisible();
    // A figure off the dashboard, so this cannot pass on a frame with nothing under it.
    await expect(page.getByText('Net worth')).toBeVisible();

    expect(faults, `signing in reported ${faults.length} fault(s)`).toEqual([]);
  });
});

/**
 * Every figure on the dashboard came back from the server.
 *
 * The screen checks prove the page draws without erroring, which a dashboard would also do with
 * every one of its reads having failed — each card states its own absence and the page carries on,
 * which is the behaviour that was wanted and is exactly why a silent failure would look like a
 * pass. So these assert the opposite of the absence: the cards that only exist when their read
 * succeeded, and the notice that names any that did not.
 */
test.describe('the reads behind the dashboard', () => {
  test('a plain company reports nothing unread', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Balance sheet, profit and loss, cash flow, exceptions and the register, all in one line.
    await expect(page.getByText(/could not be read/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Where the money is' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Recently filed' })).toBeVisible();
  });

  test('a company with bill-wise and multi-currency gets both of those cards too', async ({
    page,
  }) => {
    await signIn(page);
    await page.goto(`/companies/${featuredId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    /*
      Three more reads than the plain company makes — receivables, payables and the gain and loss —
      and each card is drawn only when its own read came back. A feature switched on whose endpoint
      refused would show as the notice rather than as an empty card.
    */
    await expect(page.getByText(/could not be read/)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Owed to us, owed by us' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Currency exposure' })).toBeVisible();
  });

  test('a company without those features is not shown their cards', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Not merely empty — absent. An empty ageing card reads as "nothing overdue".
    await expect(page.getByRole('heading', { name: 'Owed to us, owed by us' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Currency exposure' })).toHaveCount(0);
  });
});

/**
 * Whose companies the tab is holding, after the person using it changes.
 *
 * The list is read once and remembered, and nothing reloads the page on a sign-out — so the next
 * person to sign in on the same tab was being shown the previous person's companies: their names
 * and their codes, in the switcher at the top of every screen. Signing out and back in is the
 * cheapest way to drive it, and what is asserted is that the list is genuinely fetched again rather
 * than answered from what was already in memory.
 */
test.describe('signing out and back in', () => {
  test('reads the company list again rather than keeping the last one', async ({ page }) => {
    const listReads: number[] = [];
    await page.route('**/api/v1/companies', async (route) => {
      if (route.request().method() === 'GET') listReads.push(Date.now());
      await route.continue();
    });

    await page.goto('/');
    await page.getByLabel('Email').fill(ACCOUNT.email);
    await page.getByLabel('Password').fill(ACCOUNT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Companies', level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');

    const readsBefore = listReads.length;
    expect(readsBefore, 'the list was never read at all').toBeGreaterThan(0);

    await page.getByRole('button', { name: new RegExp(ACCOUNT.name) }).click();
    await page.getByRole('menuitem', { name: /Log out/ }).click();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();

    await page.getByLabel('Email').fill(ACCOUNT.email);
    await page.getByLabel('Password').fill(ACCOUNT.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('heading', { name: 'Companies', level: 1 })).toBeVisible();
    await page.waitForLoadState('networkidle');

    /*
      The whole point. Before the store was cleared on a change of user this count did not move —
      the second person's screen was drawn entirely from the first person's answer.
    */
    expect(
      listReads.length,
      'the list was served from the previous session rather than read again',
    ).toBeGreaterThan(readsBefore);

    // And what is on screen is right, which a permanently blank switcher would also fail.
    await expect(page.getByRole('link', { name: 'Open ADB - INR' })).toBeVisible();
  });
});

/**
 * Choosing a company happens in one place, top right.
 *
 * The menu bar and the function-key strip each used to offer their own way back to the company
 * list. Two of the three are gone; what these check is that they stayed gone, and that the one
 * that remains can actually reach everything the other two did.
 */
test.describe('choosing a company', () => {
  test('is offered nowhere on the menu bar or the strip', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();

    // Every menu on the bar, opened in turn, and every item it holds.
    const menus = await page.locator('[aria-haspopup="menu"][aria-expanded]').all();
    const destinations: string[] = [];
    for (const menu of menus) {
      const label = (await menu.getAttribute('aria-label')) ?? '';
      // The switcher is the one control that is allowed to reach it; it is checked below.
      if (label === '') continue;
      await menu.click();
      for (const item of await page.getByRole('menuitem').all()) {
        destinations.push((await item.getAttribute('href')) ?? '');
      }
      await page.keyboard.press('Escape');
    }

    expect(destinations.length, 'no menu opened').toBeGreaterThan(10);
    expect(destinations.filter((href) => href === '/companies')).toEqual([]);

    // And the strip: no action on it leads to the list either.
    const strip = await page.getByRole('button').allInnerTexts();
    expect(strip.filter((text) => /^Company$/.test(text.trim()))).toEqual([]);
  });

  test('reaches the full list from the switcher, and nothing else does', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);

    await page.getByRole('button', { name: /ADB - INR/ }).click();
    await page
      .getByRole('menu', { name: 'Switch company' })
      .getByRole('menuitem', { name: /All companies/ })
      .click();

    await expect(page).toHaveURL(/\/companies$/);
  });

  test('asks rather than hides when no company is open', async ({ page }) => {
    await signIn(page);
    await page.goto('/companies');

    /*
      It used to hide outside a company, on the reasoning that there was nothing to switch. With the
      menu bar no longer offering the list, hiding leaves the one screen that has no other company
      control — so it reads as the prompt it is.
    */
    const trigger = page.getByRole('button', { name: /Select company/ });
    await expect(trigger).toBeVisible();

    await trigger.click();
    await page
      .getByRole('menu', { name: 'Switch company' })
      .getByRole('menuitem', { name: /KG Business/ })
      .click();

    // No section to carry from the list, so the choice opens that company's dashboard.
    await expect(page).toHaveURL(new RegExp(`/companies/${analyticsId}$`));
    await expect(page.getByText('Portfolio dashboard')).toBeVisible();
  });
});

/**
 * The two keys this session moved. Alt+D was the Day Book and is now the Dashboards menu; the Day
 * Book took Alt+K. Both are bound by different handlers on the same document, which is exactly the
 * arrangement that hid the collision in the first place.
 */
test.describe('the keys that moved', () => {
  test('Alt+D opens the Dashboards menu', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Dashboards' })).toBeVisible();

    await page.keyboard.press('Alt+KeyD');

    await expect(page.getByRole('menuitem', { name: /Company dashboard/ })).toBeVisible();
    // And it did not also fire the Day Book underneath the menu it opened.
    await expect(page).toHaveURL(new RegExp(`/companies/${companyId}$`));
  });

  test('Alt+O opens the dashboard from wherever you are', async ({ page }) => {
    await signIn(page);
    // From a report, which is where somebody actually presses it.
    await page.goto(`/companies/${companyId}/reports?report=trial-balance`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();

    await page.keyboard.press('Alt+KeyO');

    await expect(page).toHaveURL(new RegExp(`/companies/${companyId}$`));
    await expect(page.getByText('Company dashboard')).toBeVisible();
  });

  test('Alt+K still opens the Day Book', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${companyId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();

    await page.keyboard.press('Alt+KeyK');

    await expect(page).toHaveURL(/report=day-book/);
    await expect(page.getByRole('heading', { name: 'Day Book' })).toBeVisible();
  });
});

/**
 * A company id that is not a company.
 *
 * A stale bookmark, a link from an old note, an id belonging to a company since deleted. The frame
 * has to stay up and say so — a dashboard is the screen most likely to be bookmarked, and the worst
 * answer is a blank page with the chrome still promising there is something behind it.
 */
test.describe('an address that names no company', () => {
  test('says so, and leaves a way out', async ({ page }) => {
    const crashes: string[] = [];
    page.on('pageerror', (error) => crashes.push(error.message));

    await signIn(page);
    await page.goto('/companies/000000000000000000000000');
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    // Said out loud rather than left blank.
    await expect(page.getByText(/not found|could not|Could not/)).toBeVisible();
    // And the switcher is still there, which is the only way back to another company.
    await expect(page.locator('[aria-haspopup="menu"]').last()).toBeVisible();
    expect(crashes, `the screen threw ${crashes.length} time(s)`).toEqual([]);
  });
});

/**
 * The portfolio dashboard, in the two conditions the screen sweep only ever puts the accounting one
 * through. Both were found by looking rather than by reasoning, which is the point of having them.
 */
test.describe('the portfolio dashboard', () => {
  test('reads in the dark theme', async ({ page }) => {
    const faults: string[] = [];
    page.on('pageerror', (error) => faults.push(error.message));

    await signIn(page);
    await page.addInitScript(() => window.localStorage.setItem('owm.theme', 'dark'));
    await page.goto(`/companies/${analyticsId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    /*
      By role, not by text. "Yet to report" is on this screen twice on purpose — once as the count
      in the tile and once as the heading over the names — and a bare text match cannot tell a
      deliberate repetition from a duplicated element.
    */
    await expect(page.getByRole('heading', { name: 'League table' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Yet to report' })).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(
      overflow,
      `the dark portfolio dashboard scrolls sideways by ${overflow}px`,
    ).toBeLessThanOrEqual(0);
    expect(faults, `the dark portfolio dashboard reported ${faults.length} fault(s)`).toEqual([]);

    // The readable record, for someone reviewing what a change did.
    await page.screenshot({ path: 'e2e/screenshots/portfolio-dark.png', fullPage: true });
  });

  test('is not offered the statements it can never have', async ({ page }) => {
    await signIn(page);
    await page.goto(`/companies/${analyticsId}`);
    await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
    await page.waitForLoadState('networkidle');

    /*
      Nothing is ever posted into an analytics workspace, so a balance sheet, a profit and loss and
      a day book over it are blank by construction. Checked after the company has actually loaded —
      the menu is drawn while the type is still unknown, and asserting before that would pass on a
      frame that has not decided yet.
    */
    await expect(page.getByRole('button', { name: 'Reports' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Balance Sheet/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Profit & Loss/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Day Book/ })).toHaveCount(0);

    // What it does get, in place of all of them.
    await expect(page.getByRole('button', { name: /Portfolio/ })).toBeVisible();
  });
});

/**
 * The width between the two designs.
 *
 * Below 48rem a record list becomes cards and a statement scrolls; above 60rem both are ordinary
 * tables. In between, the record lists scroll too — a band nothing had ever been drawn at, and the
 * one where a rule written for one end can quietly fail at the other.
 */
test.describe('at the width between the two', () => {
  test.use({ viewport: { width: 900, height: 900 } });

  for (const screen of [
    { name: 'the company dashboard', path: () => `/companies/${companyId}` },
    { name: 'the portfolio dashboard', path: () => `/companies/${analyticsId}` },
  ]) {
    test(`${screen.name} does not spill`, async ({ page }) => {
      await signIn(page);
      await page.goto(screen.path());
      await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
      await page.waitForLoadState('networkidle');

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen.name} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

      /*
        And no card is wider than the column holding it. The page not scrolling is not the same as
        nothing spilling — a card that overflows its own column clips instead, which is how the
        register lost its amounts on a phone without failing the check above.
      */
      const spilling = await page.evaluate(
        () =>
          [...document.querySelectorAll('section')].filter(
            (card) => card.scrollWidth > card.clientWidth + 1,
          ).length,
      );
      expect(spilling, `${spilling} card(s) overflow their own width`).toBe(0);
    });
  }
});

/**
 * The phone is not a second design, but nothing may overflow. The sweep covers the accounting
 * dashboard at this width; these are the two it does not.
 */
test.describe('on a narrow screen', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  for (const screen of [
    { name: 'the portfolio dashboard', file: 'portfolio', path: () => `/companies/${analyticsId}` },
    { name: 'the company dashboard', file: 'company', path: () => `/companies/${companyId}` },
  ]) {
    test(`${screen.name} fits`, async ({ page }) => {
      await signIn(page);
      await page.goto(screen.path());
      await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible();
      await page.waitForLoadState('networkidle');

      await page.screenshot({ path: `e2e/screenshots/${screen.file}-narrow.png`, fullPage: true });

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${screen.name} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(0);

      /*
        And nothing spills its own card, which is the check that matters at this width.

        The page not scrolling sideways is not the same as nothing overflowing: a card wider than
        its column clips instead, and clipping is silent. That is exactly how the register lost the
        right-hand end of every amount and the whole draft mark on a 390px screen while passing the
        assertion above.
      */
      const spilling = await page.evaluate(
        () =>
          [...document.querySelectorAll('section')].filter(
            (card) => card.scrollWidth > card.clientWidth + 1,
          ).length,
      );
      expect(spilling, `${spilling} card(s) overflow their own width`).toBe(0);

      // The switcher is the only company control there is, so it has to survive the narrow width.
      await expect(page.locator('[aria-haspopup="menu"]').first()).toBeVisible();
    });
  }
});
