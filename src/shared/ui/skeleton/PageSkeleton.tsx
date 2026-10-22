import { SkeletonBlock } from './Skeleton';
import styles from './Skeleton.module.css';

const LIST_WIDTHS = ['88%', '72%', '94%', '64%', '80%', '70%'];

/**
 * - `dashboard` — a row of headline tiles over a chart and a list.
 * - `cards`     — a grid of record cards.
 * - `table`     — a list of records on a card.
 * - `rows`      — the same rows bare, for a panel that already draws its own card.
 */
export type PageSkeletonVariant = 'dashboard' | 'cards' | 'table' | 'rows';

export interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  /** How many rows (table, rows) or cards (cards) — roughly what is coming. */
  count?: number;
  /** Draw a title and toolbar too, for a screen that has nothing of its own on screen yet. */
  heading?: boolean;
  /** What is being read, for anyone who cannot see the placeholder. */
  label?: string;
}

function Heading() {
  return (
    <div className={styles.toolbar}>
      <div className={styles.heading} style={{ flex: '1 1 16rem' }}>
        <SkeletonBlock width="7rem" height="0.625rem" />
        <SkeletonBlock width="14rem" height="1.5rem" />
        <SkeletonBlock width="min(28rem, 100%)" height="0.625rem" />
      </div>
      <SkeletonBlock width="8rem" height="2.25rem" radius="var(--radius-md)" />
    </div>
  );
}

function Tile() {
  return (
    <div className={styles.surface}>
      <SkeletonBlock width="45%" height="0.625rem" />
      <SkeletonBlock width="65%" height="1.5rem" />
      <SkeletonBlock width="85%" height="0.5rem" />
    </div>
  );
}

function Rows({ count }: { count: number }) {
  return (
    <div className={styles.rows}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className={styles.row}>
          <SkeletonBlock width="70%" />
          <SkeletonBlock width={index % 2 ? '60%' : '85%'} />
          <SkeletonBlock width="55%" />
          <SkeletonBlock width="40%" height="1.125rem" radius="var(--radius-full)" />
        </div>
      ))}
    </div>
  );
}

function Card() {
  return (
    <div className={styles.surface}>
      <div className={styles.cardTop}>
        <SkeletonBlock width="2.25rem" height="2.25rem" radius="0.625rem" />
        <div className={styles.cardText}>
          <SkeletonBlock width="70%" height="0.875rem" />
          <SkeletonBlock width="50%" height="0.625rem" />
        </div>
      </div>
      <div className={styles.pair}>
        <SkeletonBlock width="80%" height="1.125rem" />
        <SkeletonBlock width="80%" height="1.125rem" />
      </div>
      <div className={styles.footer}>
        <SkeletonBlock width="5rem" height="0.625rem" />
        <SkeletonBlock width="3.5rem" height="0.875rem" />
      </div>
    </div>
  );
}

/**
 * The frame of a screen, shimmering, while its data is on the way — so the page arrives already
 * shaped like itself and nothing jumps when the figures land.
 */
export function PageSkeleton({
  variant = 'table',
  count,
  heading = false,
  label = 'Loading…',
}: PageSkeletonProps) {
  let body;
  switch (variant) {
    case 'dashboard':
      body = (
        <>
          <div className={styles.tiles}>
            {Array.from({ length: 4 }, (_, index) => (
              <Tile key={index} />
            ))}
          </div>
          <div className={styles.panels}>
            <div className={styles.surface}>
              <SkeletonBlock width="40%" height="0.875rem" />
              <SkeletonBlock height="14rem" />
            </div>
            <div className={styles.surface}>
              <SkeletonBlock width="50%" height="0.875rem" />
              {Array.from({ length: count ?? 6 }, (_, index) => (
                <SkeletonBlock key={index} width={LIST_WIDTHS[index % LIST_WIDTHS.length]} />
              ))}
            </div>
          </div>
        </>
      );
      break;
    case 'cards':
      body = (
        <div className={styles.cards}>
          {Array.from({ length: count ?? 4 }, (_, index) => (
            <Card key={index} />
          ))}
        </div>
      );
      break;
    case 'rows':
      body = <Rows count={count ?? 4} />;
      break;
    default:
      body = (
        <div className={styles.surface}>
          <Rows count={count ?? 8} />
        </div>
      );
  }

  return (
    <div className={styles.page} role="status" aria-busy="true" aria-label={label}>
      {heading && <Heading />}
      {body}
    </div>
  );
}
