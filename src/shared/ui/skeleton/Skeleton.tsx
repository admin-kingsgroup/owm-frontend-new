import type { CSSProperties } from 'react';

import { cn } from '@/shared/lib';

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
 * in. A whole screen uses PageSkeleton, which draws the frame as well.
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

export interface SkeletonBlockProps {
  width?: CSSProperties['width'];
  height?: CSSProperties['height'];
  /** Round for a chip or avatar, a pill for a badge — defaults to a soft rectangle. */
  radius?: CSSProperties['borderRadius'];
  className?: string;
}

/**
 * One shimmering shape standing in for one thing — a figure, a chip, a chart. Silent to a screen
 * reader: whatever holds it says what is loading.
 */
export function SkeletonBlock({
  width = '100%',
  height = '0.75rem',
  radius,
  className,
}: SkeletonBlockProps) {
  return (
    <span
      className={cn(styles.block, className)}
      style={{ width, height, borderRadius: radius }}
      aria-hidden="true"
    />
  );
}
