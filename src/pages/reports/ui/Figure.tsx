import styles from './ReportsPage.module.css';

interface FigureProps {
  /** Already formatted. An empty string means nil — see `money` on the reports screen. */
  amount: string;
  /** The side the balance falls on. Omitted where the figure carries no side of its own. */
  side?: 'DEBIT' | 'CREDIT';
}

/**
 * One figure, and the side it falls on.
 *
 * Reports format a nil as an empty string, so that a statement whose columns are mostly zero does
 * not bury the two figures that are not. That leaves the side marker with nothing to qualify: every
 * such row printed a lone "Dr", which reads as a figure that failed to load rather than as a group
 * holding nothing. A dot says what the grids say, and the side goes with the number it belonged to.
 */
export function Figure({ amount, side }: FigureProps) {
  if (!amount) return <span className={styles.treeNil}>·</span>;

  return (
    <>
      {amount}
      {side && <span className={styles.priorSide}>{side === 'DEBIT' ? 'Dr' : 'Cr'}</span>}
    </>
  );
}
