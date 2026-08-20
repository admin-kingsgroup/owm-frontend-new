export interface BalanceInput {
  debit: string;
  credit: string;
  /** Empty for a base-currency line. */
  currencyCode: string;
  exchangeRate: string;
}

export interface BalanceResult {
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
  /** True when a foreign line has no rate yet, so it cannot be weighed at all. */
  awaitingRate: boolean;
}

/**
 * Whether the entries balance, judged in the base currency.
 *
 * A voucher balances in base currency, not in the currency any one line was typed in, so a foreign
 * line is converted before it is counted. Without a rate the line cannot be weighed at all — that
 * is reported as `awaitingRate` rather than as an imbalance, because "you have not given me a
 * rate" and "your debits do not match your credits" are different problems and telling the user
 * the second when the first is true sends them looking in the wrong place.
 *
 * Compared with a half-paisa tolerance: converting a foreign amount produces a fraction, and
 * requiring exact equality of two floats would report a balanced voucher as unbalanced.
 */
export function computeBalance(entries: BalanceInput[]): BalanceResult {
  const rateFor = (row: BalanceInput) => (row.currencyCode ? Number(row.exchangeRate) || 0 : 1);
  const awaitingRate = entries.some((row) => row.currencyCode && !Number(row.exchangeRate));

  const totalDebit = entries.reduce((sum, row) => sum + (Number(row.debit) || 0) * rateFor(row), 0);
  const totalCredit = entries.reduce(
    (sum, row) => sum + (Number(row.credit) || 0) * rateFor(row),
    0,
  );

  return {
    totalDebit,
    totalCredit,
    awaitingRate,
    isBalanced: !awaitingRate && totalDebit > 0 && Math.abs(totalDebit - totalCredit) < 0.005,
  };
}
