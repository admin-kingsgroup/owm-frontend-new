import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

import { seed, seedLongText } from './seed';

/**
 * Every screen, at every size the installed app is actually used at.
 *
 * The app ships as a PWA, so a phone, a tablet held either way and a small laptop are all real
 * screens rather than a desktop design squeezed. The other specs check a phone at one width and
 * against text a person typed; this one checks five sizes against text a bank wrote — narrations
 * and ledger names with no space in them, which a browser will not break unless told it may.
 * That is the case that let the dashboard's Recently filed cards run off a phone while the 390px
 * checks passed.
 */

let token: string;
let longId: string;

test.beforeAll(async () => {
  ({ token } = await seed());
  longId = await seedLongText(token);
});

const DEVICES = [
  { name: 'small-phone', viewport: { width: 320, height: 640 }, touch: true },
  { name: 'phone', viewport: { width: 390, height: 844 }, touch: true },
  { name: 'large-phone', viewport: { width: 430, height: 932 }, touch: true },
  { name: 'tablet', viewport: { width: 768, height: 1024 }, touch: true },
  { name: 'tablet-landscape', viewport: { width: 1024, height: 768 }, touch: true },
  { name: 'laptop', viewport: { width: 1280, height: 800 }, touch: false },
] as const;

const SCREENS: Array<{ name: string; path: () => string }> = [
  { name: 'companies', path: () => '/companies' },
  { name: 'dashboard', path: () => `/companies/${longId}` },
  { name: 'vouchers', path: () => `/companies/${longId}/vouchers` },
  { name: 'voucher-entry', path: () => `/companies/${longId}/vouchers?new=PAYMENT` },
  { name: 'accounts', path: () => `/companies/${longId}?tab=accounts` },
  { name: 'voucher-types', path: () => `/companies/${longId}?tab=voucher-types` },
  { name: 'financial-years', path: () => `/companies/${longId}?tab=financial-years` },
  { name: 'settings', path: () => `/companies/${longId}?tab=settings` },
  { name: 'import-export', path: () => `/companies/${longId}?tab=import-export` },
  ...[
    'balance-sheet',
    'profit-loss',
    'trial-balance',
    'day-book',
    'cash-book',
    'bank-book',
    'group-summary',
    'receipts-payments',
    'monthly-summary',
  ].map((report) => ({
    name: `report-${report}`,
    path: () => `/companies/${longId}/reports?report=${report}`,
  })),
  { name: 'reported-errors', path: () => '/reported-errors' },
];

const IGNORED_TRANSPORT =
  /net::(ERR_NETWORK_CHANGED|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_IO_SUSPENDED)/;

async function signIn(page: Page) {
  await page.addInitScript((value) => {
    window.localStorage.setItem('owm_access_token', value);
  }, token);
}

for (const device of DEVICES) {
  test.describe(`on a ${device.name} (${device.viewport.width}×${device.viewport.height})`, () => {
    test.use({
      viewport: device.viewport,
      hasTouch: device.touch,
      isMobile: device.touch && device.viewport.width < 800,
    });

    for (const screen of SCREENS) {
      test(`${screen.name} fits`, async ({ page }) => {
        const faults: string[] = [];
        page.on('pageerror', (error) => faults.push(`uncaught: ${error.message}`));
        page.on('console', (message) => {
          if (message.type() !== 'error' || IGNORED_TRANSPORT.test(message.text())) return;
          faults.push(`console: ${message.text()}`);
        });

        await signIn(page);
        await page.goto(screen.path());
        await expect(page.locator('main').first()).toBeVisible();
        await page.waitForLoadState('networkidle');
        // Entrance animations move cards a few pixels; measure where they come to rest.
        await page.waitForTimeout(700);

        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect.soft(overflow, 'the page must never scroll sideways').toBeLessThanOrEqual(1);

        /*
          Anything past the screen's edge with nothing to scroll it into view is simply gone — the
          end of a figure, a status badge, the last button in a bar.
        */
        const stranded = await page.evaluate(() => {
          const viewport = document.documentElement.clientWidth;
          const out: string[] = [];
          for (const element of document.body.querySelectorAll('*')) {
            const box = element.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;
            if (box.right <= viewport + 1 && box.left >= -1) continue;

            let parent = element.parentElement;
            let held = false;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if (style.position === 'fixed' && style.visibility === 'hidden') break;
              if (style.overflowX !== 'visible' && style.overflowX !== 'clip') {
                held = true;
                break;
              }
              parent = parent.parentElement;
            }
            if (!held) {
              const label = (element.textContent ?? '').trim().slice(0, 30);
              out.push(`${element.tagName.toLowerCase()} "${label}"`);
            }
          }
          return [...new Set(out)].slice(0, 10);
        });
        expect.soft(stranded, 'nothing may sit past the edge with no way to reach it').toEqual([]);

        /*
          The page not scrolling is not the same as nothing spilling: an element can run out of its
          own card and over the one beside it while staying on screen. Anything that leaves its card
          has to be inside something that scrolls or clips it on purpose.
        */
        const escaping = await page.evaluate(() => {
          const out: string[] = [];
          for (const card of document.querySelectorAll('main section')) {
            const edge = card.getBoundingClientRect();
            for (const element of card.querySelectorAll('*')) {
              const box = element.getBoundingClientRect();
              if (box.width === 0 || box.height === 0) continue;
              if (box.right <= edge.right + 1 && box.left >= edge.left - 1) continue;

              let parent = element.parentElement;
              let held = false;
              while (parent && parent !== card) {
                if (getComputedStyle(parent).overflowX !== 'visible') {
                  held = true;
                  break;
                }
                parent = parent.parentElement;
              }
              if (!held) {
                const label = (element.textContent ?? '').trim().slice(0, 30);
                out.push(`${element.tagName.toLowerCase()} "${label}"`);
              }
            }
          }
          return [...new Set(out)].slice(0, 10);
        });
        expect.soft(escaping, 'nothing may run out of its own card').toEqual([]);

        /*
          Clipping is the quiet version of both checks above: a box that hides its overflow keeps
          the page tidy and loses the text. For an amount that is worse than untidy — the KPI tiles
          cut 1,23,45,678.90 to 1,23,45,678. on a small phone. Text cut short on purpose says so
          with an ellipsis; any other text that runs past a clipping box is a fault.
        */
        const clipped = await page.evaluate(() => {
          const out: string[] = [];
          const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
          for (let node = walker.nextNode(); node; node = walker.nextNode()) {
            const text = node.textContent?.trim();
            const host = node.parentElement;
            if (!text || !host) continue;

            const range = document.createRange();
            range.selectNodeContents(node);
            const box = range.getBoundingClientRect();
            if (box.width === 0 || box.height === 0) continue;

            let parent: HTMLElement | null = host;
            while (parent && parent !== document.body) {
              const style = getComputedStyle(parent);
              if (style.textOverflow === 'ellipsis') break;
              // A fixed box — a dialog — is not clipped by anything above it.
              if (style.position === 'fixed') break;
              if (style.overflowX === 'auto' || style.overflowX === 'scroll') break;
              if (style.overflowX === 'hidden' || style.overflowX === 'clip') {
                const edge = parent.getBoundingClientRect();
                // A one-pixel box is a screen-reader-only label, hidden on purpose.
                if (edge.width > 2 && (box.right > edge.right + 2 || box.left < edge.left - 2)) {
                  out.push(`"${text.slice(0, 30)}"`);
                }
                break;
              }
              parent = parent.parentElement;
            }
          }
          return [...new Set(out)].slice(0, 10);
        });
        expect.soft(clipped, 'no text may be cut off without an ellipsis').toEqual([]);

        if (device.touch) {
          // 44px is the figure both platform guidelines land on for a target under a thumb.
          const small = await page.evaluate(() =>
            [
              ...document.querySelectorAll(
                'button, select, input:not([type=checkbox]):not([type=radio]):not([type=hidden])',
              ),
            ]
              .filter((control) => {
                const style = getComputedStyle(control);
                return style.visibility !== 'hidden' && style.display !== 'none';
              })
              .map((control) => {
                const box = control.getBoundingClientRect();
                return {
                  what:
                    control.getAttribute('aria-label') ||
                    control.textContent?.trim().slice(0, 24) ||
                    control.tagName.toLowerCase(),
                  height: Math.round(box.height),
                };
              })
              .filter((control) => control.height > 0 && control.height < 44),
          );
          expect.soft(small, 'every control needs a thumb-sized target').toEqual([]);
        }

        expect.soft(faults, 'the screen reported faults').toEqual([]);

        // Last: a full-page capture resizes the viewport while it works.
        await page.screenshot({
          path: `e2e/screenshots/devices/${device.name}-${screen.name}.png`,
          fullPage: true,
        });
      });
    }
  });
}
