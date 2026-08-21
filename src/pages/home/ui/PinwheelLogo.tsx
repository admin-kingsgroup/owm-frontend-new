import styles from './PinwheelLogo.module.css';

/**
 * One hue, stepped light to dark around the turn.
 *
 * The mark used to be six unrelated colours — violet, blue, teal — from before the product
 * settled on a single amber accent. A logo in colours the rest of the interface never uses reads
 * as belonging to something else, and this is the first thing anyone sees.
 */
const BLADES = [
  { angle: 0, color: '#f5b06a' },
  { angle: 60, color: '#e59a4e' },
  { angle: 120, color: '#d3833a' },
  { angle: 180, color: '#c0702a' },
  { angle: 240, color: '#a75d1c' },
  { angle: 300, color: '#8f4c14' },
];

export interface PinwheelLogoProps {
  size?: number;
}

export function PinwheelLogo({ size = 96 }: PinwheelLogoProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="KBiz360 OWM logo">
      <rect width="100" height="100" rx="22" ry="22" fill="#0c0e14" />
      <g transform="translate(50,50)">
        <g className={styles.blades}>
          {BLADES.map(({ angle, color }) => (
            <g key={angle} transform={`rotate(${angle})`}>
              <rect x="-11" y="-38" width="22" height="32" fill={color} transform="skewX(-20)" />
            </g>
          ))}
        </g>
        <circle cx="0" cy="0" r="6.5" fill="#0c0e14" />
      </g>
    </svg>
  );
}
