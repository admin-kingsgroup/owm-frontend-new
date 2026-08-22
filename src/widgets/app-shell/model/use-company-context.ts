import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getCompanyContext } from '@/entities/report';
import type { CompanyContext } from '@/entities/report';

interface CompanyReadout {
  /** Null until the first read settles, and after one that failed. Never assumed. */
  context: CompanyContext | null;
  /** Re-reads it. Called after anything that changes the books — see useCompanyReadout. */
  refresh: () => void;
}

const CompanyReadoutContext = createContext<CompanyReadout>({
  context: null,
  refresh: () => {},
});

export const CompanyReadoutProvider = CompanyReadoutContext.Provider;

/**
 * What the frame knows about the open company: the year being posted into, whether the books
 * balance, and how many vouchers are still drafts.
 *
 * Read once by the shell and shared, so a screen that wants any of it — the gateway wants all three
 * — costs no extra request. `refresh` is the other half of that bargain: because the shell holds
 * the only copy, a screen that changes the books has to say so, and posting a voucher does.
 */
export function useCompanyReadout(): CompanyReadout {
  return useContext(CompanyReadoutContext);
}

/**
 * The shell's own copy. One request per company, tagged with the company it describes so switching
 * cannot leave the previous one's year on screen.
 *
 * Everything it carries is chrome: a failure leaves the strip saying less, never blocks a screen and
 * never raises an error of its own.
 */
export function useCompanyReadoutState(companyId: string | undefined): CompanyReadout {
  const [state, setState] = useState<{ companyId: string; context: CompanyContext } | null>(null);
  const [nonce, setNonce] = useState(0);

  const refresh = useCallback(() => setNonce((current) => current + 1), []);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;
    let cancelled = false;

    getCompanyContext(id)
      .then((context) => {
        if (!cancelled) setState({ companyId: id, context });
      })
      .catch(() => {
        // Chrome, not content — see above.
      });

    return () => {
      cancelled = true;
    };
  }, [companyId, nonce]);

  /*
    Memoised because this is a context value: a fresh object on every render of the shell would
    re-render every screen under it, and the shell renders on every navigation.
  */
  const context = state && state.companyId === companyId ? state.context : null;

  return useMemo(() => ({ context, refresh }), [context, refresh]);
}
