import styles from './PinwheelLogo.module.css';

/**
 * One hue, stepped light to dark around the turn.
 *
 * The mark used to be six unrelated colours — violet, blue, teal — from before the product had
 * settled on one accent. A logo in colours the rest of the interface never uses reads as belonging
 * to something else, and this is the first thing anyone sees.
 *
 * These are the two ends of the Graphite accent and four steps between them: the light pair is the
 * blue the dark theme uses, the dark pair the blue the light theme uses. They are written out
 * rather than read from the tokens because this screen is deliberately one fixed dark hero — see
 * HomePage.module.css, which hardcodes its ground for the same reason — and a mark that changed
 * colour with the reader's theme would be a different mark twice. **If the accent moves again,
 * these move with it**; the amber they replace was left behind by exactly that oversight, and for
 * one release the mark was in a colour the product no longer contained anywhere.
 */
const BLADES = [
  { angle: 0, color: '#9abcf5' },
  { angle: 60, color: '#7ea9f0' },
  { angle: 120, color: '#5a8ae6' },
  { angle: 180, color: '#3f72dc' },
  { angle: 240, color: '#2a63d6' },
  { angle: 300, color: '#1a52c4' },
];

export interface PinwheelLogoProps {
  size?: number;
}

export function PinwheelLogo({ size = 96 }: PinwheelLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="KBiz360 OWM logo">
      {/* The page's own ground, so the mark sits on it rather than in a tile of its own. It was
          left on the colour the login screen used before Graphite, which showed as a dark square
          a shade off the page behind it. */}
      <rect width="100" height="100" rx="22" ry="22" fill="#111214" />
      <g transform="translate(50,50)">
        <g className={styles.blades}>
          {BLADES.map(({ angle, color }) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <rect x="-11" y="-38" width="22" height="32" fill={color} transform="skewX(-20)" />
            </g>
          ))}
        </g>
        {/* The hub, on the same ground as the backdrop above — it was left behind on the old
            colour when the rest of the mark moved. */}
        <circle cx="0" cy="0" r="6.5" fill="#111214" />
      </g>
    </svg>
  );
}
