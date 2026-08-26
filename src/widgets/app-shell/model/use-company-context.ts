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
        /*
          A 200 is not proof of a body. Answer an API path with the app's own HTML — a proxy rule
          that falls through to index.html, a gateway rewriting a rejected response — and this
          resolves carrying nothing at all. Stored, that makes the type above a lie: `context` is
          declared as the readout or null, every consumer reads it on that promise, and the first
          one to reach for a field on it throws. The strip that shows the draft count is rendered
          outside the boundary that catches such a throw, so what a reader gets is not a panel with
          a message in it but the whole screen gone.

          Treated as a miss instead. Chrome, not content: the strip says less, exactly as it does
          after a request that failed outright.
        */
        if (!cancelled && context && typeof context === 'object') {
          setState({ companyId: id, context });
        }
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
