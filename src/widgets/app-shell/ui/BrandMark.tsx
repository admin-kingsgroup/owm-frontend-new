import styles from './BrandMark.module.css';

/**
 * The pinwheel: four quarters turning slowly — the companies of a group moving as one.
 *
 * The same four hues as the chart series, so the mark and the figures it sits above are visibly
 * one product. Stops turning for anyone who asked for less motion (the global reduced-motion rule).
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className={styles.mark} width={size} height={size} viewBox="0 0 44 44" aria-hidden="true">
      <g className={styles.wheel}>
        <path d="M22 22 L22 4 A18 18 0 0 1 40 22 Z" fill="var(--series-1)" />
        <path d="M22 22 L40 22 A18 18 0 0 1 22 40 Z" fill="var(--series-3)" />
        <path d="M22 22 L22 40 A18 18 0 0 1 4 22 Z" fill="var(--series-2)" />
        <path d="M22 22 L4 22 A18 18 0 0 1 22 4 Z" fill="#eda100" />
        <circle cx="22" cy="22" r="5" fill="var(--sidebar)" />
      </g>
    </svg>
  );
}
