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
 * The menus, for the company that is open.
 *
 * Everything here resolves to a route that exists. A menu that lists destinations the product does
 * not have is worse than a short menu: it teaches you that the menu cannot be trusted. Items that
 * depend on a company feature are dropped when the feature is off, exactly as the screens behind
 * them already do.
 */
export function buildMenus(companyId: string | undefined, company: Company | null): Menu[] {
  if (!companyId) {
    return [
      {
        id: 'company',
        label: 'Company',
        mnemonic: 'C',
        items: [{ label: 'All companies', to: '/companies' }],
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
      items: isPortfolio
        ? [{ label: 'Portfolio', to: `${base}/kg` }]
        : [{ label: 'Vouchers', to: `${base}/vouchers`, hint: 'Alt+V' }],
    },
    {
      id: 'reports',
      label: 'Reports',
      mnemonic: 'R',
      items: [
        { label: 'Balance Sheet', to: `${base}/reports?report=balance-sheet`, hint: 'Alt+B' },
        { label: 'Profit & Loss', to: `${base}/reports?report=profit-loss`, hint: 'Alt+P' },
        { label: 'Trial Balance', to: `${base}/reports?report=trial-balance` },
        { label: 'Cash Flow', to: `${base}/reports?report=cash-flow` },
        {
          label: 'Receipts & Payments',
          to: `${base}/reports?report=receipts-payments`,
        },
        {
          label: 'Day Book',
          to: `${base}/reports?report=day-book`,
          hint: 'Alt+D',
          section: 'Books & registers',
        },
        ...(features?.billWiseDetails
          ? [
              {
                label: 'Receivables',
                to: `${base}/reports?report=receivables`,
                section: 'Outstanding',
              },
              { label: 'Payables', to: `${base}/reports?report=payables` },
            ]
          : []),
        ...(features?.multiCurrency
          ? [
              {
                label: 'Forex gain / loss',
                to: `${base}/reports?report=forex`,
                section: 'Currency',
              },
            ]
          : []),
      ],
    },
  ];
}
