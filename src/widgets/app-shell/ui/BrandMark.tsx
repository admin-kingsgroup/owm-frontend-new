import styles from './BrandMark.module.css';

/**
 * The KBiz360 pinwheel — the product's own app icon, the same picture as the installed app and the
 * browser tab.
 *
 * Drawn from the 192px icon `npm run icons` makes out of public/kb360-logo.png, so there is one
 * source for every copy of the mark, and it stays sharp up to three times the largest size here.
 * Decorative where it sits beside the product's name; the name is the text.
 */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <img
      className={styles.mark}
      src="/pwa-192x192.png"
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
