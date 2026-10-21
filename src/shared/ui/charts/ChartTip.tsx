import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { cn } from '@/shared/lib';

import type { TipState } from './chart-hooks';
import styles from './Charts.module.css';

/** The tooltip itself, drawn into <body> and kept on screen near the pointer. See useChartTip. */
export function ChartTip({ tip }: { tip: TipState }) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ left: tip.x + 14, top: tip.y - 12 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const { offsetWidth: w, offsetHeight: h } = element;
    let left = tip.x + 14;
    let top = tip.y - h - 10;
    if (left + w > window.innerWidth - 8) left = tip.x - w - 14;
    if (top < 8) top = tip.y + 16;
    setPosition({ left: Math.max(8, left), top });
  }, [tip.x, tip.y, tip.title]);

  return createPortal(
    <div ref={ref} className={styles.tip} style={position} role="tooltip">
      <div className={styles.tipTitle}>{tip.title}</div>
      {tip.rows.map((row) => (
        <div className={styles.tipRow} key={row.label}>
          <i className={styles.swatch} style={{ background: row.color }} />
          {row.label}
          <b>{row.value}</b>
        </div>
      ))}
      {tip.foot && (
        <div className={cn(styles.tipRow, styles.tipFoot)}>
          {tip.foot.label}
          <b>{tip.foot.value}</b>
        </div>
      )}
    </div>,
    document.body,
  );
}
