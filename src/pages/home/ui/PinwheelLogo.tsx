import styles from './PinwheelLogo.module.css';

const BLADES = [
  { angle: 0, color: '#9a6cf0' },
  { angle: 60, color: '#d8d3c8' },
  { angle: 120, color: '#4f8bff' },
  { angle: 180, color: '#37b6a4' },
  { angle: 240, color: '#e8a13a' },
  { angle: 300, color: '#e3674e' },
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
