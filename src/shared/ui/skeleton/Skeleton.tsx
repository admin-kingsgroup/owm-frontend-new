import styles from './Skeleton.module.css';

export interface SkeletonProps {
  /** How many lines. Roughly what is coming, so the panel does not jump when it arrives. */
  lines?: number;
  /**
   * What is being read, for anyone who cannot see the placeholder.
   *
   * The shape says "something is loading" to a reader who can see it and nothing at all to one who
   * cannot, so the words are still carried — just not drawn.
   */
  label?: string;
}

/* Varied so the block reads as text rather than as a bar chart, and stable between renders. */
const WIDTHS = ['72%', '100%', '88%', '94%', '61%', '100%', '80%', '46%'];

/**
 * The shape of what is coming, while it is coming.
 *
 * For a panel inside a page that has already drawn — the page keeps its layout and one card fills
 * in. A whole route still uses Loading, where there is no shape to hold yet.
 */
export function Skeleton({ lines = 4, label = 'Loading…' }: SkeletonProps) {
  return (
    <div className={styles.stack} role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, index) => (
        <span
          key={index}
          className={styles.line}
          style={{ width: WIDTHS[index % WIDTHS.length] }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}
