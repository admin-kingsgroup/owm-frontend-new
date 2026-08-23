import { useEffect, useRef, useState } from 'react';

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
 *
 * `mastersVersion` is the company's `seedVersion`, and it is here for one reason: syncing the
 * default masters is the only thing that adds voucher types from outside this list's own screen.
 * The shell does not remount when it happens, so without a dependency on the version the menus and
 * the button bar would go on offering the old set for the rest of the session — a sync that
 * appears to have done nothing.
 *
 * It is `undefined` until the company record arrives, and that first arrival is deliberately not
 * treated as a change: it is the same set of books, now identified. Only a move between two known
 * versions means masters were inserted. Taken as a change, every cold load of a company screen
 * read this list twice — once before the company was known and once after — for a number that had
 * not moved.
 */
export function useVoucherTypes(
  companyId: string | undefined,
  mastersVersion?: number,
): VoucherType[] {
  const [state, setState] = useState<{ companyId: string; types: VoucherType[] } | null>(null);

  /**
   * The company and version this list was last asked for.
   *
   * A ref rather than state: it decides whether to read, so holding it in state would re-run the
   * effect that writes it.
   */
  const asked = useRef<{ companyId: string; version: number | undefined } | null>(null);

  /**
   * Which read is allowed to answer. Only ever the latest, so a slower earlier one cannot land on
   * top of it — switching company, or syncing masters while the first read is still out.
   */
  const latest = useRef(0);

  useEffect(() => {
    if (!companyId) return;
    const id = companyId;

    const previous = asked.current;
    if (previous?.companyId === id) {
      // Learning the version for the first time is not a move; record it so the next one is seen.
      if (previous.version === undefined) previous.version = mastersVersion;
      if (mastersVersion === undefined || previous.version === mastersVersion) return;
    }

    asked.current = { companyId: id, version: mastersVersion };
    const mine = ++latest.current;

    /*
      No cleanup that discards the answer, deliberately.

      Cancelling on teardown is the usual shape and it is wrong here, because the guard above means
      a torn-down read is not started again: StrictMode mounts, tears down and remounts, so the one
      request in flight was being thrown away and the second pass returned early — the list never
      arrived at all, and the bar fell back to the four types every company has. Superseding by
      number instead: whoever was asked last is the only one that may answer, which covers the
      company changing and the masters moving while a read is still out, and leaves a read whose
      effect merely ran twice free to land.
    */
    listVoucherTypes(id)
      .then((types) => {
        if (latest.current === mine) {
          setState({ companyId: id, types: types.filter((type) => type.isActive) });
        }
      })
      .catch(() => {
        // Chrome, not content — see above.
      });
  }, [companyId, mastersVersion]);

  // Tagged with the company it describes, so switching cannot leave the previous one's types up.
  return state && state.companyId === companyId ? state.types : EMPTY;
}

/** One frozen array rather than a new one each render, which would rebuild the menus every time. */
const EMPTY: VoucherType[] = [];
