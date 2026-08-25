import { describe, it, expect } from 'vitest';

import { toDateInput, formatCalendarDay, calendarYear } from './calendar-date';

/**
 * The API treats voucher and financial-year dates as calendar days serialised at UTC midnight.
 * Reading one back in local time shifts the day backwards for every viewer west of UTC; writing
 * `toISOString()` shifts it forwards for everyone east of it. Either direction silently reports a
 * voucher on the wrong day, and at a year boundary in the wrong financial year.
 */
describe('calendar dates', () => {
  describe('toDateInput', () => {
    it('takes the local calendar day, not the UTC one', () => {
      // Late evening in a zone ahead of UTC is already the next day locally; a date input must
      // show the day the user is actually living in.
      const date = new Date(2026, 3, 1, 23, 30); // 1 April, local
      expect(toDateInput(date)).toBe('2026-04-01');
    });

    it('pads month and day', () => {
      expect(toDateInput(new Date(2026, 0, 5))).toBe('2026-01-05');
    });

    it('handles the last day of a year', () => {
      expect(toDateInput(new Date(2026, 11, 31))).toBe('2026-12-31');
    });
  });

  describe('calendarYear', () => {
    it('reads an API day in UTC so it cannot slip across 1 January', () => {
      // In any zone behind UTC this instant is still 31 December locally — and reading it that way
      // would file the voucher in the wrong financial year.
      expect(calendarYear('2027-01-01T00:00:00.000Z')).toBe(2027);
    });

    it('reads the financial year boundary correctly', () => {
      expect(calendarYear('2026-04-01T00:00:00.000Z')).toBe(2026);
      expect(calendarYear('2027-03-31T00:00:00.000Z')).toBe(2027);
    });

    it('accepts a Date as well as a string', () => {
      expect(calendarYear(new Date('2026-06-15T00:00:00.000Z'))).toBe(2026);
    });
  });

  describe('formatCalendarDay', () => {
    it('renders the stored day, not the day it becomes locally', () => {
      // Whatever the viewer's zone, this must not come out as 31 March. Asserted as the day
      // itself rather than as one particular spelling of it, so the wording below is free to
      // change without this case pretending the UTC handling broke.
      const shown = formatCalendarDay('2026-04-01T00:00:00.000Z');
      // 1 April, spelled however the reader's machine spells it — never 31 March.
      expect(shown).toContain('2026');
      expect(shown).not.toContain('31');
      expect(shown).not.toContain('Mar');
    });

    it('writes the month as a word when no country says how to order it', () => {
      /*
        Without a company there is no convention to follow. Numbers alone would be read one way by
        the writer and another by the reader — 8/25 and 25/8 are the same day and different days —
        so the month is spelled instead.
      */
      const shown = formatCalendarDay('2026-08-25T00:00:00.000Z');
      expect(shown).toMatch(/Aug/);
      expect(shown).not.toMatch(/^\d+[/]\d+[/]\d+$/);
    });

    it('follows the country when one is given', () => {
      // India writes the day first; the United States writes the month first. Both are numeric,
      // and each is right where it is asked for.
      expect(formatCalendarDay('2026-08-25T00:00:00.000Z', 'IN')).toMatch(/^25[/]8[/]2026$/);
      expect(formatCalendarDay('2026-08-25T00:00:00.000Z', 'US')).toMatch(/^8[/]25[/]2026$/);
    });
  });
});
