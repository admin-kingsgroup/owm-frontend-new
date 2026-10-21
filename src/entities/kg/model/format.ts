/** A ratio, or a dash where it had no denominator — never 0%, which would be a claim. */
export function ratio(value?: string) {
  return value === undefined ? '—' : `${Number(value).toFixed(1)}%`;
}
