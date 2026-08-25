import type { Company } from '@/entities/company';
import {
  ALWAYS_SEEDED_PORTFOLIO_CODES,
  ALWAYS_SEEDED_VOUCHER_CODES,
  inFunctionKeyOrder,
  raisableVoucherTypes,
  type VoucherType,
} from '@/entities/voucher-type';

export interface MenuItem {
  label: string;
  to: string;
  /** Shown right-aligned in the row — the key that reaches it without opening the menu. */
  hint?: string;
  /** Starts a labelled block within the menu. Reports is long enough to need them. */
  section?: string;
}

export interface Menu {
  id: string;
  label: string;
  /** Alt + this letter opens the menu. Always the label's first letter, and underlined in it. */
  mnemonic: string;
  items: MenuItem[];
}

/**
 * The period a report is being read at, as a fragment to append to another report's link.
 *
 * Moving between statements keeps the period you are reading. It is Tally's F2: set it once and it
 * stays put as you move around, because the whole point of setting it is to look at more than one
 * statement over the same span. The period lives in the address now, so carrying it means copying
 * it onto the link — and without that, opening Profit & Loss from Cash Flow silently threw the
 * dates and the comparison away.
 *
 * Empty when there is nothing to carry, so a link built anywhere else is untouched.
 */
export function periodQuery(here: string): string {
  const mark = here.indexOf('?');
  if (mark < 0) return '';

  const current = new URLSearchParams(here.slice(mark + 1));
  const kept = new URLSearchParams();
  for (const key of ['from', 'to', 'compare']) {
    const value = current.get(key);
    if (value) kept.set(key, value);
  }

  const text = kept.toString();
  return text ? `&${text}` : '';
}

/**
 * Where raising this document begins, for a company of this kind.
 *
 * Shared by the Transactions menu and the button bar so the two doors cannot send the same document
 * to two different places.
 *
 * A set of books goes to the voucher form, which is what that form is for. A portfolio workspace
 * goes to its registry instead, and that is not a preference — the generic form **cannot** post its
 * documents. The accounts a portfolio posts to are minted by the business registry and namespaced
 * with a slash (`KG_TEXTILES/INV`, `KG_TEXTILES/CAP/PTR_A`), while the voucher API validates
 * `ledgerCode` as `[A-Z0-9_]+`. So every entry against them is refused, and refused late: the form
 * fills, balances, and answers `ledgerCode must be alphanumeric` on accept. Sending someone there
 * is sending them to a dead end with a developer's error message at the bottom of it.
 *
 * The document asked for rides along in `raise`. The registry ignores a parameter it does not know,
 * so today this simply lands there — and when the workspace grows an entry screen of its own it can
 * open on the right document without the shell being touched again. Those entries also need a
 * business, a period and a profit split, none of which the generic form has any notion of, which is
 * why the registry is where they belong rather than somewhere the voucher form could be taught.
 */
export function raiseVoucherPath(base: string, code: string, isPortfolio: boolean): string {
  return isPortfolio ? `${base}/kg?raise=${code}` : `${base}/vouchers?new=${code}`;
}

/**
 * The menus, for the company that is open.
 *
 * Everything here resolves to a route that exists. A menu that lists destinations the product does
 * not have is worse than a short menu: it teaches you that the menu cannot be trusted. Items that
 * depend on a company feature are dropped when the feature is off, exactly as the screens behind
 * them already do.
 */
export function buildMenus(
  companyId: string | undefined,
  company: Company | null,
  /** Where the app is now, as "/path?query" — the Help sheet opens over it rather than replacing it. */
  here: string,
  /**
   * Whether the reader administers this installation. Only two destinations turn on it, and both
   * are refused by the server for anyone else — so listing them regardless would be a menu offering
   * something the product will not do, which is the one thing the note above rules out.
   */
  isAdmin = false,
  /**
   * The company's own voucher types, for the registers and the Create list.
   *
   * Passed in rather than fetched here so this stays a pure function of what it is given — and
   * because the shell already holds them. Empty while they are still loading, or if the read
   * failed: both menus simply carry fewer entries, and every one of them is also reachable from
   * the reports screen's picker.
   */
  voucherTypes: VoucherType[] = [],
  /**
   * Whether the server has answered with them yet.
   *
   * The Create list stands in for the types every posting company is seeded with while it has not —
   * exactly as the button bar does, and from the same function, because the two are two doors onto
   * the same set of documents. Without it a read that failed left the menu with nothing to raise
   * for the rest of the session while the strip beside it went on offering four.
   *
   * The registers below deliberately do not stand anything in: they are reports, and the reports
   * screen's own picker is what answers while this list is short.
   *
   * Defaults to trusting the list it was given, so a caller that does not track the difference
   * simply gets a menu naming exactly what it passed — the behaviour before this existed. Only the
   * shell, which holds the read, says otherwise.
   */
  voucherTypesKnown = true,
): Menu[] {
  const period = periodQuery(here);
  const orderedTypes = inFunctionKeyOrder(voucherTypes);

  if (!companyId) {
    /*
      No Company menu here. Choosing a company is the top-right switcher's alone, and outside a
      company that menu held nothing else — a Company menu whose only item is the screen you are
      already on is a menu that teaches you not to open it.
    */
    return [
      {
        id: 'help',
        label: 'Help',
        mnemonic: 'H',
        items: [
          { label: 'Keyboard shortcuts', to: withHelp(here) },
          ...(isAdmin
            ? [{ label: 'Reported errors', to: '/reported-errors', section: 'Diagnostics' }]
            : []),
        ],
      },
    ];
  }

  const base = `/companies/${companyId}`;
  const features = company?.features;
  const isPortfolio = company?.type === 'ANALYTICS';

  /**
   * What Transactions offers to raise — the strip's list exactly. See raisableVoucherTypes.
   *
   * Nothing at all until the company record has arrived, because `isPortfolio` is false both for a
   * company that keeps books and for one nobody has identified yet, and the two want opposite
   * answers. Read as "keeps books", an unidentified portfolio was offered Contra, Payment, Receipt
   * and Journal — four documents it does not hold and never will — each pointing at a voucher form.
   * The stand-in exists to name what certainly exists; when the kind is unknown, nothing does.
   *
   * The wait is as long as one request that the shell fires on mount anyway, and a company that
   * cannot be identified has a blank context strip and an empty switcher already, so a Create list
   * that waits with them is the consistent answer rather than a lone confident guess.
   */
  const raisable =
    company === null
      ? []
      : raisableVoucherTypes(
          voucherTypes,
          voucherTypesKnown,
          isPortfolio ? ALWAYS_SEEDED_PORTFOLIO_CODES : ALWAYS_SEEDED_VOUCHER_CODES,
        );

  return [
    {
      /*
        First on the bar, because it is where opening a company lands and the thing most often
        wanted on the way back. One item, deliberately: the group dashboard is the selection screen
        and belongs to the switcher, and splitting this company's figures into six themed
        dashboards would be a second navigation tree over the numbers Reports already serves.

        Named for which dashboard it is. An analytics workspace posts nothing, so its dashboard
        answers an entirely different question from a set of books' — and the word is the only
        warning anyone gets before the screen changes shape.
      */
      id: 'dashboards',
      label: 'Dashboards',
      mnemonic: 'D',
      items: [
        {
          label: isPortfolio ? 'Portfolio dashboard' : 'Company dashboard',
          to: base,
          hint: 'Alt+O',
        },
      ],
    },
    {
      id: 'company',
      label: 'Company',
      mnemonic: 'C',
      items: [
        { label: 'Financial years', to: `${base}?tab=financial-years` },
        ...(features?.multiCurrency
          ? [{ label: 'Currencies & rates', to: `${base}?tab=currencies` }]
          : []),
        { label: 'Features & settings', to: `${base}?tab=settings` },
      ],
    },
    {
      id: 'masters',
      label: 'Masters',
      mnemonic: 'M',
      /*
        All five master screens, including the two that also appear under Company. A menu bar is
        allowed to offer a second way to the same place, and Masters is where somebody looking for
        financial years or exchange rates goes first — under Company they were findable only by
        someone who already knew where they were.
      */
      items: [
        { label: 'Chart of accounts & ledgers', to: `${base}?tab=accounts` },
        { label: 'Parties — customers & suppliers', to: `${base}?tab=parties` },
        { label: 'Voucher types & numbering', to: `${base}?tab=voucher-types` },
        { label: 'Financial years', to: `${base}?tab=financial-years` },
        ...(features?.multiCurrency
          ? [{ label: 'Currencies & rates', to: `${base}?tab=currencies` }]
          : []),
      ],
    },
    {
      id: 'transactions',
      label: 'Transactions',
      mnemonic: 'T',
      /*
        Entering a voucher is the first thing this product is for, so it is named on the menu bar
        rather than in the right-hand strip, which belongs to whichever screen is open. The function
        keys printed here are the real bindings — the shell holds them, so they work from anywhere.
      */
      items: [
        /*
          A portfolio's own screen first, because the registry is what that workspace is mostly
          for and it is where Alt+V still lands. No hint on Vouchers beneath it for the same
          reason: printing Alt+V against a second destination would be the menu naming a key that
          does something else.
        */
        ...(isPortfolio ? [{ label: 'Portfolio', to: `${base}/kg` }] : []),
        {
          label: 'Vouchers',
          to: `${base}/vouchers`,
          ...(isPortfolio ? {} : { hint: 'Alt+V' }),
        },
        /*
          Every type the company actually keeps, in its own order, each with the key the shell
          binds for it where there is one. A company that has added a type gets it here; one
          that has switched a type off does not. See raisableVoucherTypes — the same list the
          button bar is drawn from, so neither can offer a document the other does not.

          A portfolio workspace is here too. It was left out while nothing was ever posted to one,
          and that stopped being true when it was seeded with four voucher types of its own —
          capital in, profit reported, profit shared out, and a correction. Leaving the menu on the
          old answer meant a workspace holding four documents offered no way to raise any of them.
        */
        ...raisable.map((type, index) => ({
          label: type.name,
          to: raiseVoucherPath(base, type.code, isPortfolio),
          ...(type.key ? { hint: type.key } : {}),
          ...(index === 0 ? { section: 'Create' } : {}),
        })),
      ],
    },
    /*
      Statements, for a company that keeps books.

      Dropped whole for an analytics workspace. Nothing is ever posted there — no voucher reaches
      it, by design — so every one of the twenty-odd entries below would open a statement that is
      permanently empty. The note at the top of this file rules out a menu that lists destinations
      the product does not have; a menu that lists destinations which exist and can only ever be
      blank is the same lesson learnt more slowly.
    */
    ...(isPortfolio
      ? []
      : [
          {
            id: 'reports',
            label: 'Reports',
            mnemonic: 'R',
            items: [
              {
                label: 'Balance Sheet',
                to: `${base}/reports?report=balance-sheet${period}`,
                hint: 'Alt+B',
              },
              {
                label: 'Profit & Loss',
                to: `${base}/reports?report=profit-loss${period}`,
                hint: 'Alt+P',
              },
              { label: 'Trial Balance', to: `${base}/reports?report=trial-balance${period}` },
              { label: 'Cash Flow', to: `${base}/reports?report=cash-flow${period}` },
              {
                label: 'Receipts & Payments',
                to: `${base}/reports?report=receipts-payments${period}`,
              },
              {
                label: 'Day Book',
                to: `${base}/reports?report=day-book${period}`,
                hint: 'Alt+K',
                section: 'Books & registers',
              },
              /*
          A register per voucher type, from the company's own list rather than a written-out eight:
          a fixed list would offer registers for types a company has deleted and hide any it has
          added. The reports screen keeps its picker, which is what answers while these load.
        */
              ...orderedTypes.map((type, index) => ({
                label: `${type.name} Register`,
                to: `${base}/reports?report=register&type=${type.code}${period}`,
                ...(index === 0 ? { section: 'Registers' } : {}),
              })),
              { label: 'Ledger — account statement', to: `${base}/reports?report=ledger${period}` },
              { label: 'Cash Book', to: `${base}/reports?report=cash-book${period}` },
              { label: 'Bank Book', to: `${base}/reports?report=bank-book${period}` },
              { label: 'Group Summary', to: `${base}/reports?report=group-summary${period}` },
              { label: 'Monthly Summary', to: `${base}/reports?report=monthly-summary${period}` },
              {
                label: 'Bank Reconciliation',
                to: `${base}/reports?report=bank-reconciliation${period}`,
                section: 'Reconcile',
              },
              ...(features?.billWiseDetails
                ? [
                    {
                      label: 'Statement of Account',
                      to: `${base}/reports?report=statement-of-account${period}`,
                    },
                  ]
                : []),
              ...(features?.billWiseDetails
                ? [
                    {
                      label: 'Receivables',
                      to: `${base}/reports?report=receivables${period}`,
                      section: 'Outstanding',
                    },
                    { label: 'Payables', to: `${base}/reports?report=payables${period}` },
                  ]
                : []),
              ...(features?.multiCurrency
                ? [
                    {
                      label: 'Forex Gain/Loss',
                      to: `${base}/reports?report=forex${period}`,
                      section: 'Currency',
                    },
                  ]
                : []),
            ],
          },
        ]),
    {
      id: 'analysis',
      label: 'Analysis',
      mnemonic: 'A',
      items: [
        ...(isPortfolio ? [{ label: 'Portfolio valuation', to: `${base}/kg` }] : []),
        /*
          These read across the statements rather than being one of them — funds flow sets the
          balance sheet's two ends against each other, ratios divide it by the profit and loss, and
          the exception list walks the lot. Reports is already the longest menu in the product.

          All three are derived from statements an analytics workspace does not have, so it gets
          the portfolio above and nothing else here.
        */
        ...(isPortfolio
          ? []
          : [
              { label: 'Funds Flow', to: `${base}/reports?report=funds-flow${period}` },
              { label: 'Ratios', to: `${base}/reports?report=ratios${period}` },
              {
                label: 'Exceptions — what to check before signing',
                to: `${base}/reports?report=exceptions${period}`,
              },
            ]),
        /*
          The group view — every company's cash, profit and draft backlog side by side — is the
          selection screen, so it is reached the way every company is: the switcher, top right.
          Naming it here as well would be a second door onto the one screen that must have exactly
          one.
        */
      ],
    },
    {
      id: 'utilities',
      label: 'Utilities',
      mnemonic: 'U',
      /*
        The maintenance jobs, gathered under the word people look for them under. Each is a real
        screen that already exists elsewhere in the tree — a menu bar is allowed to offer a second
        way to the same place, and this is the way someone thinking "I need to check the books"
        looks.
      */
      items: [
        /*
          Both of these are about ledgers, and an analytics workspace is seeded with the group tree
          and no ledgers at all — there is no trial balance to verify and nothing to open a balance
          on. What follows applies to any company.
        */
        ...(isPortfolio
          ? []
          : [
              {
                label: 'Verify books — trial balance',
                to: `${base}/reports?report=trial-balance${period}`,
              },
              { label: 'Opening balances', to: `${base}?tab=accounts` },
            ]),
        { label: 'Import & export masters', to: `${base}?tab=import-export` },
        { label: 'Close or reopen a financial year', to: `${base}?tab=financial-years` },
        {
          label: 'Audit trail — who changed what',
          to: `${base}/reports?report=audit${period}`,
          section: 'Records',
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      mnemonic: 'H',
      // Opened over whatever is on screen rather than navigating away from it: a shortcut list is
      // most useful while you are looking at the screen you wanted the shortcut for.
      items: [
        { label: 'Keyboard shortcuts', to: withHelp(here) },
        ...(isAdmin
          ? [{ label: 'Reported errors', to: '/reported-errors', section: 'Diagnostics' }]
          : []),
      ],
    },
  ];
}

/** The current location with the shortcut sheet asked for, keeping every other parameter. */
function withHelp(here: string): string {
  const [path, query = ''] = here.split('?');
  const params = new URLSearchParams(query);
  params.set('help', 'shortcuts');
  return `${path}?${params.toString()}`;
}
