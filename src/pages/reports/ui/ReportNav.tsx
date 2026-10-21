import { Link, useSearchParams } from 'react-router-dom';

import type { Company } from '@/entities/company';
import { cn } from '@/shared/lib';

import { TAB_LABELS, type Tab } from './tabs';
import styles from './ReportsPage.module.css';

interface ReportNavProps {
  tab: Tab;
  company: Company | null;
}

interface Section {
  heading: string;
  items: Array<{ tab: Tab; hint?: string }>;
}

/**
 * Every report, listed down the left of the screen under the heading it belongs to.
 *
 * The same reports the old Reports menu carried, with the same rule deciding which exist: a report
 * behind bill-wise details or multi-currency is listed only for a company that has switched it on.
 * Until the company is known nothing feature-gated is listed — "not switched on" and "not known
 * yet" are the same boolean, and guessing would offer a report and then take it away.
 *
 * Each link carries the period being read. Moving between statements keeps the span you set, which
 * is the whole point of setting it: to read more than one statement over the same dates.
 */
export function ReportNav({ tab, company }: ReportNavProps) {
  const [searchParams] = useSearchParams();
  const billWise = company?.features.billWiseDetails ?? false;
  const multiCurrency = company?.features.multiCurrency ?? false;

  const sections: Section[] = [
    {
      heading: 'Statements',
      items: [
        { tab: 'balance-sheet', hint: 'Alt+B' },
        { tab: 'profit-loss', hint: 'Alt+P' },
        { tab: 'trial-balance' },
        { tab: 'cash-flow' },
        { tab: 'receipts-payments' },
      ],
    },
    {
      heading: 'Books & registers',
      items: [
        { tab: 'day-book', hint: 'Alt+K' },
        { tab: 'register' },
        { tab: 'ledger' },
        { tab: 'cash-book' },
        { tab: 'bank-book' },
        { tab: 'group-summary' },
        { tab: 'monthly-summary' },
      ],
    },
    {
      heading: 'Reconcile',
      items: [
        { tab: 'bank-reconciliation' },
        ...(billWise ? [{ tab: 'statement-of-account' as const }] : []),
      ],
    },
    ...(billWise
      ? [
          {
            heading: 'Outstanding',
            items: [{ tab: 'receivables' as const }, { tab: 'payables' as const }],
          },
        ]
      : []),
    ...(multiCurrency ? [{ heading: 'Currency', items: [{ tab: 'forex' as const }] }] : []),
    {
      heading: 'Analysis',
      items: [{ tab: 'funds-flow' }, { tab: 'ratios' }, { tab: 'exceptions' }],
    },
    { heading: 'Records', items: [{ tab: 'audit' }] },
  ];

  /* The period travels with every link; the subject (a ledger, a voucher type) does not. */
  const carried = new URLSearchParams();
  for (const key of ['from', 'to', 'compare']) {
    const value = searchParams.get(key);
    if (value) carried.set(key, value);
  }
  const suffix = carried.toString() ? `&${carried.toString()}` : '';

  return (
    <nav className={styles.nav} aria-label="Reports">
      {sections.map((section) => (
        <div className={styles.navSection} key={section.heading}>
          <span className={styles.navHeading}>{section.heading}</span>
          {section.items.map((item) => (
            <Link
              key={item.tab}
              to={`?report=${item.tab}${suffix}`}
              className={cn(styles.navItem, item.tab === tab && styles.navCurrent)}
              aria-current={item.tab === tab ? 'page' : undefined}
            >
              {item.tab === 'register' ? 'Registers' : TAB_LABELS[item.tab]}
              {item.hint && <kbd className={styles.navKey}>{item.hint}</kbd>}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
