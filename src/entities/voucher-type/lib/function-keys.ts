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
