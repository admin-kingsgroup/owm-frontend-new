import { useEffect, useState } from 'react';

import { listVoucherTypes } from '@/entities/voucher-type';
import type { VoucherType } from '@/entities/voucher-type';

/**
 * The company's voucher types, for the menus that name them.
 *
 * The Reports menu lists a register per voucher type and the Transactions menu a way to raise one,
 * and neither can be written down in advance: the eight seeded types are only a starting point, a
 * company may add its own and may switch one off. A fixed list would offer registers for types
 * that no longer exist and hide the ones somebody actually created.
 *
 * One request per company, and chrome rather than content — a failure leaves the menus shorter,
 * never blocks a screen and never raises an error of its own. Every destination it produces is
 * also reachable from the reports screen's own picker, so a short menu is a smaller menu rather
 * than a dead end.
 */
export function useVoucherTypes(companyId: string | undefined): VoucherType[] {
  const [state, setState] = useState<{ companyId: string; types: VoucherType[] } | null>(null);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    listVoucherTypes(id)
      .then((types) => {
        if (!cancelled) setState({ companyId: id, types: types.filter((type) => type.isActive) });
      })
      .catch(() => {
        // Chrome, not content — see above.
      });

    return () => {
      cancelled = true;
    };
  }, [companyId]);

  // Tagged with the company it describes, so switching cannot leave the previous one's types up.
  return state && state.companyId === companyId ? state.types : EMPTY;
}

/** One frozen array rather than a new one each render, which would rebuild the menus every time. */
const EMPTY: VoucherType[] = [];
