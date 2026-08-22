import type { Company } from '@/entities/company';

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
): Menu[] {
  const period = periodQuery(here);

  if (!companyId) {
    return [
      {
        id: 'company',
        label: 'Company',
        mnemonic: 'C',
        items: [{ label: 'All companies', to: '/companies' }],
      },
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

  return [
    {
      id: 'company',
      label: 'Company',
      mnemonic: 'C',
      items: [
        { label: 'Overview', to: base, hint: 'Alt+O' },
        { label: 'Financial years', to: `${base}?tab=financial-years` },
        ...(features?.multiCurrency
          ? [{ label: 'Currencies & rates', to: `${base}?tab=currencies` }]
          : []),
        { label: 'Features & settings', to: `${base}?tab=settings` },
        { label: 'All companies', to: '/companies', section: 'Switch' },
      ],
    },
    {
      id: 'masters',
      label: 'Masters',
      mnemonic: 'M',
      items: [
        { label: 'Chart of accounts & ledgers', to: `${base}?tab=accounts` },
        { label: 'Voucher types & numbering', to: `${base}?tab=voucher-types` },
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
      items: isPortfolio
        ? [{ label: 'Portfolio', to: `${base}/kg` }]
        : [
            { label: 'Vouchers', to: `${base}/vouchers`, hint: 'Alt+V' },
            { label: 'Contra', to: `${base}/vouchers?new=CONTRA`, hint: 'F4', section: 'Create' },
            { label: 'Payment', to: `${base}/vouchers?new=PAYMENT`, hint: 'F5' },
            { label: 'Receipt', to: `${base}/vouchers?new=RECEIPT`, hint: 'F6' },
            { label: 'Journal', to: `${base}/vouchers?new=JOURNAL`, hint: 'F7' },
          ],
    },
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
          hint: 'Alt+D',
          section: 'Books & registers',
        },
        { label: 'Cash Book', to: `${base}/reports?report=cash-book${period}` },
        { label: 'Bank Book', to: `${base}/reports?report=bank-book${period}` },
        { label: 'Group Summary', to: `${base}/reports?report=group-summary${period}` },
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
    {
      id: 'analysis',
      label: 'Analysis',
      mnemonic: 'A',
      items: [
        ...(isPortfolio ? [{ label: 'Portfolio valuation', to: `${base}/kg` }] : []),
        // Every company the signed-in user can reach, with its cash, profit and draft backlog —
        // the one view in the product that looks across the whole group rather than into one set
        // of books.
        { label: 'Group overview — all companies', to: '/companies' },
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
        looks. What is deliberately absent is import/export and an audit trail: neither exists yet,
        and a menu that lists what the product cannot do teaches you not to trust the menu.
      */
      items: [
        {
          label: 'Verify books — trial balance',
          to: `${base}/reports?report=trial-balance${period}`,
        },
        { label: 'Opening balances', to: `${base}?tab=accounts` },
        { label: 'Close or reopen a financial year', to: `${base}?tab=financial-years` },
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
