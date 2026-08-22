import { useEffect, useState } from 'react';

import { listFinancialYears, currentFinancialYear } from '@/entities/financial-year';
import type { FinancialYear } from '@/entities/financial-year';
import { getTrialBalance } from '@/entities/report';

interface CompanyContext {
  /** The year the company is actually posting into, or null while unknown. */
  financialYear: FinancialYear | null;
  /**
   * Trial balance difference, as the server wrote it. '0.00' means the books balance. Null while
   * it is unknown — which is not the same as zero, and must not be drawn as if it were.
   */
  difference: string | null;
}

/**
 * What the context strip states: which year, and whether the books balance.
 *
 * Neither can be read off the company record. `financialYearStart` there is the *first* year the
 * company was given, not the one it is working in, and the difference is a property of the postings
 * rather than of the company. Both are fetched once on entering a company, tagged with the company
 * they belong to so switching cannot leave the previous company's year on screen.
 *
 * Everything here is chrome: a failure leaves the strip saying less, never blocks a screen, and
 * never raises an error of its own. The trial balance is the heavier of the two calls, and it is
 * the price of being able to say "balanced" honestly rather than assuming it.
 */
export function useCompanyContext(companyId: string | undefined): CompanyContext {
  const [context, setContext] = useState<{ companyId: string; value: CompanyContext } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    // Settled independently: a company with no financial year still reports its difference, and a
    // trial balance that cannot be computed still leaves the year on screen.
    listFinancialYears(id)
      .then((years) => {
        if (cancelled) return;
        setContext((current) => ({
          companyId: id,
          value: {
            difference: current?.companyId === id ? current.value.difference : null,
            financialYear: currentFinancialYear(years),
          },
        }));
      })
      .catch(() => {});

    getTrialBalance(id)
      .then((report) => {
        if (cancelled) return;
        setContext((current) => ({
          companyId: id,
          value: {
            financialYear: current?.companyId === id ? current.value.financialYear : null,
            difference: report.totals.difference,
          },
        }));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  if (!companyId || context?.companyId !== companyId) {
    return { financialYear: null, difference: null };
  }

  return context.value;
}
