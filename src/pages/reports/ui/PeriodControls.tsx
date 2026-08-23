import { useState } from 'react';

import { Button, Input, Checkbox } from '@/shared/ui';

import styles from './ReportsPage.module.css';

export interface AppliedPeriod {
  /** "YYYY-MM-DD", or empty for the whole financial year — which is what the server defaults to. */
  from: string;
  to: string;
  compare: boolean;
}

interface PeriodControlsProps {
  /** The period the statement on screen is actually built from. */
  applied: AppliedPeriod;
  /** Whether this particular report answers a comparison. */
  canCompare: boolean;
  /** Writes a date the way the company's country writes it, for the echo under each box. */
  day: (value: string) => string;
  onApply: (next: AppliedPeriod) => void;
}

/**
 * The From / To / Compare boxes, and the button that applies them.
 *
 * Each box echoes its date underneath, written the way the company's country writes it. A native
 * date input is drawn in the *browser's* locale and nothing in the page can change that — `lang`
 * on the element or the document has no effect in Chromium, which I checked rather than assumed.
 * So an Indian firm on an en-US machine reads 03/31/2027 and a firm reading it as 3 March cannot
 * tell they are wrong. The echo costs one line and removes the ambiguity entirely.
 *
 * Split out so the reports screen can reset it by key rather than by effect. What is typed here is
 * a draft — nothing has been asked of the server until Apply — but the applied period lives in the
 * address, and anything that changes the address without leaving this screen (Back, Forward, a
 * link that carries no period) has to be reflected here too. Remounting on a new applied period
 * does that in one line, where syncing it back into state would mean an effect that fires a second
 * render every time either changes.
 */
export function PeriodControls({ applied, canCompare, day, onApply }: PeriodControlsProps) {
  const [from, setFrom] = useState(applied.from);
  const [to, setTo] = useState(applied.to);
  const [compare, setCompare] = useState(applied.compare);

  return (
    <div className={styles.toolbar}>
      <div className={styles.periodField}>
        <label className={styles.periodLabel} htmlFor="report-from">
          From
        </label>
        <Input
          id="report-from"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        {from && <span className={styles.periodEcho}>{day(from)}</span>}
      </div>
      <div className={styles.periodField}>
        <label className={styles.periodLabel} htmlFor="report-to">
          To
        </label>
        <Input
          id="report-to"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
        {to && <span className={styles.periodEcho}>{day(to)}</span>}
      </div>
      {/*
        Applied with the period rather than on its own, because asking for it re-fetches both
        statements — and because a comparison only means anything against a stated span.
      */}
      {canCompare && (
        <div className={styles.compareField}>
          <Checkbox
            id="report-compare"
            label="Compare with last year"
            checked={compare}
            onChange={(event) => setCompare(event.target.checked)}
          />
        </div>
      )}
      <Button variant="secondary" onClick={() => onApply({ from, to, compare })}>
        Apply
      </Button>
      {/*
        Whole year, CSV and Print are not repeated here: they are on the shell's button bar, which
        is on screen at every width and carries the key for each of them. Two buttons for one action
        is how a toolbar starts disagreeing with itself.
      */}
    </div>
  );
}
