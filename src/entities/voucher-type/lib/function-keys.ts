/**
 * Tally's function keys, against the codes the server seeds a company with.
 *
 * Named by code rather than by position: voucher types are the user's own masters and can be
 * renamed or reordered, and binding F5 to "whatever is third" would quietly point it somewhere
 * else. The label is the conventional name for the key; a screen showing the company's own types
 * shows the company's own name for them.
 *
 * This lives with the entity rather than in the shell because two places need it and they must
 * agree: the shell binds the keys, and the gateway prints them beside the documents they raise. A
 * second copy is how the two would eventually disagree about what F7 does.
 */
export const VOUCHER_FUNCTION_KEYS = [
  { key: 'F4', code: 'CONTRA', label: 'Contra' },
  { key: 'F5', code: 'PAYMENT', label: 'Payment' },
  { key: 'F6', code: 'RECEIPT', label: 'Receipt' },
  { key: 'F7', code: 'JOURNAL', label: 'Journal' },
  { key: 'F8', code: 'SALES', label: 'Sales' },
  { key: 'F9', code: 'PURCHASE', label: 'Purchase' },
  { key: 'Ctrl+F8', code: 'CREDIT_NOTE', label: 'Credit Note' },
  { key: 'Ctrl+F9', code: 'DEBIT_NOTE', label: 'Debit Note' },
  /*
    F8 and F9 again, for the books that have no Sales and no Purchase.

    They are the same two keys deliberately: in Tally F8 raises what the business earned and F9
    what it cost, and that is exactly what Income and Expense are to a household. The pair can
    never collide, because a company is either trading or personal and callers bind only what a
    company's masters actually hold.
  */
  { key: 'F8', code: 'INCOME', label: 'Income' },
  { key: 'F9', code: 'EXPENSE', label: 'Expense' },
  /*
    The four a portfolio workspace files about the businesses it tracks.

    On the Ctrl row, not on F4 to F7, and that is a correction rather than a preference. They held
    the plain keys while a portfolio was the one kind of company with no Contra, Payment, Receipt or
    Journal of its own — so nothing could contend for them. A workspace has all four of those now,
    and they claim F4 to F7 first, being earlier in this table; leaving these here left every one of
    them keyless, which is the four documents that workspace exists for losing the keyboard.

    Ctrl+F6 to Ctrl+F9 rather than Ctrl+F4 to Ctrl+F7: Ctrl+F4 closes the tab in Chrome and Edge on
    Windows and Ctrl+F5 is a hard reload, and a shortcut that throws away a half-keyed voucher is
    worse than no shortcut. Ctrl+F8 and Ctrl+F9 are shared with Credit Note and Debit Note on the
    same guarantee the household pair relies on — those two are `TRADING` only, so a portfolio can
    never hold both — and the de-duplication below covers it if a company ever invents one.

    Listed in the order they are worked in rather than alphabetically, so reading the strip down is
    the order a month is actually recorded: money in, profit earned, profit allocated, fixes last.
  */
  { key: 'Ctrl+F6', code: 'CAPITAL_INTRODUCTION', label: 'Capital Introduction' },
  { key: 'Ctrl+F7', code: 'BUSINESS_PROFIT', label: 'Business Profit' },
  { key: 'Ctrl+F8', code: 'PROFIT_ALLOCATION', label: 'Profit Allocation' },
  { key: 'Ctrl+F9', code: 'ADJUSTMENT', label: 'Adjustment' },
] as const;

/**
 * The types every posting company is seeded with, whatever kind of books it keeps.
 *
 * A stand-in for the company's own list while that list is not known. `useVoucherTypes` returns an
 * empty array both while its request is in flight and if the request fails — deliberately, since
 * the menus treat voucher types as chrome — so a caller filtering on it alone offers nothing at
 * all in either case, and the bar loses every way to enter a voucher whenever that one request
 * does not come back.
 *
 * These four are safe to offer unconditionally: money moving between accounts, in, out, or
 * adjusted exists in a trading company and a household alike. The four that differ — Sales and
 * Purchase against Income and Expense — wait until it is known which of them the company has.
 */
export const ALWAYS_SEEDED_VOUCHER_CODES: ReadonlySet<string> = new Set([
  'CONTRA',
  'PAYMENT',
  'RECEIPT',
  'JOURNAL',
]);

/**
 * The four a portfolio files **about a business it tracks** — as opposed to about its own money.
 *
 * Two callers, one meaning. It decides where raising one begins: these need a business, a period
 * and a profit split, none of which the voucher form has any notion of, and they post to accounts
 * the registry mints with a slash in the code that the voucher API refuses outright — so they go
 * to the registry, while a workspace's own Contra, Payment, Receipt and Journal are ordinary
 * vouchers and go to the form like anyone else's.
 *
 * It is also the stand-in while a workspace's real list has not arrived. Deliberately only these
 * four there, though a workspace holds eight once it reaches v6: this names what a portfolio
 * certainly has whatever version it sits at, and one still on v5 has exactly these. Naming the
 * other four would offer documents an unsynced workspace does not hold, which is the one thing the
 * stand-in exists to avoid; naming too few is only a shorter bar for a moment.
 */
export const PORTFOLIO_BUSINESS_CODES: ReadonlySet<string> = new Set([
  'CAPITAL_INTRODUCTION',
  'BUSINESS_PROFIT',
  'PROFIT_ALLOCATION',
  'ADJUSTMENT',
]);

/** The key that raises this voucher type, or undefined for a type a company invented. */
export function functionKeyFor(code: string): string | undefined {
  return VOUCHER_FUNCTION_KEYS.find((entry) => entry.code === code)?.key;
}

/**
 * Voucher types in the order their keys sit under the hand — F4, F5, F6 … — and anything without a
 * key after them, alphabetically.
 *
 * The server answers alphabetically, which puts Credit Note second in a list a reader is scanning
 * as F4, F5, F6. A type with no key has no place in that sequence, so it follows the ones that do.
 */
export function inFunctionKeyOrder<T extends { code: string; name: string }>(types: T[]): T[] {
  const order = VOUCHER_FUNCTION_KEYS.map((entry) => entry.code) as readonly string[];

  return [...types].sort((a, b) => {
    const left = order.indexOf(a.code);
    const right = order.indexOf(b.code);
    if (left !== -1 && right !== -1) return left - right;
    if (left !== -1) return -1;
    if (right !== -1) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** A document the company can raise: what it is called, what raises it, and the key that reaches it. */
export interface RaisableVoucherType {
  code: string;
  name: string;
  /** Absent for a type the company invented, and for the second claimant of a shared key. */
  key?: string;
}

/**
 * Every document this company can raise, in the order the keys sit under the hand.
 *
 * The one answer to "what can be entered here", for the two places that offer it: the shell's
 * right-hand strip and the Transactions menu. They are two doors onto the same set of documents and
 * an e2e check holds them to it — built separately, they drifted the moment the list was not known,
 * because only the strip carried the fallback. The menu then offered nothing to raise for the whole
 * of a session whose one read of the types had failed.
 *
 * `known` is the hook's, not `types.length > 0`: a company that has switched every one of its
 * voucher types off holds none on purpose, and offering four the form will refuse is worse than
 * offering none. Unknown — still reading, or read and failed — takes `standIn` instead, since a way
 * in that certainly exists beats no way in at all.
 */
export function raisableVoucherTypes(
  types: ReadonlyArray<{ code: string; name: string }>,
  known: boolean,
  /** What to name while the list is unknown. A portfolio is seeded with its own four — see above. */
  standIn: ReadonlySet<string> = ALWAYS_SEEDED_VOUCHER_CODES,
): RaisableVoucherType[] {
  if (!known) {
    return VOUCHER_FUNCTION_KEYS.filter(({ code }) => standIn.has(code)).map(
      ({ key, code, label }) => ({ code, name: label, key }),
    );
  }

  /*
    One key, one action. Income and Expense deliberately share F8 and F9 with Sales and Purchase —
    a company is either trading or personal, so the seeded pair can never both be present. A company
    is free to create a type of its own under either code though, and then the strip would print F8
    twice while only the first of them answered it. The second keeps its button and loses the key it
    does not own.
  */
  const taken = new Set<string>();

  return inFunctionKeyOrder([...types]).map((type) => {
    const key = functionKeyFor(type.code);
    const free = key !== undefined && !taken.has(key);
    if (free) taken.add(key);

    return { code: type.code, name: type.name, ...(free ? { key } : {}) };
  });
}
