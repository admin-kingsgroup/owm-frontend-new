import { localeFor } from './format-money';

/**
 * The API treats voucher and financial-year dates as calendar days and serialises them as UTC
 * midnight ("2026-08-19T00:00:00.000Z"). Reading those back with the browser's local timezone
 * shifts the day backwards for every viewer west of UTC, and writing `toISOString()` shifts it
 * forwards for everyone east of it. Both directions go through here so a calendar day always
 * survives the round trip.
 */

/** Today in the viewer's own timezone, as the "YYYY-MM-DD" an `<input type="date">` expects. */
export function todayAsDateInput(): string {
  return toDateInput(new Date());
}

/** Local calendar day of `date` as "YYYY-MM-DD" — never UTC-shifted, unlike `toISOString()`. */
export function toDateInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Renders an API calendar day, reading it back in UTC.
 *
 * Given the company's country the day is written the way that country writes it — 12/05/2026 in
 * India rather than the browser's 5/12/2026, which is the same eight characters meaning a
 * different day. Without one it falls back to the reader's own locale.
 */
export function formatCalendarDay(value: string | Date, country?: string): string {
  const date = new Date(value);

  /*
    With no company there is no convention to follow, and falling back to the reader's browser was
    how the status strip came to read 25/8/2026 inside a company and 8/25/2026 on the list of them
    — the same day, the same strip, two orders. Neither is wrong; showing both is. Where the
    country is unknown the month is written as a word instead, which cannot be read the other way
    round by anybody.
  */
  if (!country) {
    return date.toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }

  return date.toLocaleDateString(localeFor(country), { timeZone: 'UTC' });
}

/**
 * The calendar day out of an API date, as "YYYY-MM-DD".
 *
 * A plain slice rather than a parse: the API already writes the day at UTC midnight, and putting it
 * through a Date only to take the front of it back is how the day moves for anyone west of UTC.
 * Use this where the raw day is wanted — a table column, a filter value — and formatCalendarDay
 * where a person is going to read it.
 */
export function toCalendarDay(value: string): string {
  return value.slice(0, 10);
}

/** Calendar year of an API date, read in UTC so it cannot slip across a 1 January boundary. */
export function calendarYear(value: string | Date): number {
  return new Date(value).getUTCFullYear();
}
