import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChartTip } from './ChartTip';

/** Sets --len on every path that draws itself, once it is in the document and can be measured. */
export function useDrawLengths(svg: SVGSVGElement | null, deps: unknown) {
  useLayoutEffect(() => {
    if (!svg) return;
    svg.querySelectorAll<SVGPathElement>('[data-draw]').forEach((path) => {
      try {
        path.style.setProperty('--len', String(Math.ceil(path.getTotalLength()) + 1));
      } catch {
        // jsdom has no geometry; the line is simply drawn whole.
      }
    });
  }, [svg, deps]);
}

/* ---- Tooltip ---------------------------------------------------------- */

export interface TipRow {
  color: string;
  label: string;
  value: string;
}

export interface TipContent {
  title: string;
  rows: TipRow[];
  /** A closing line under a rule — a net figure, a total. */
  foot?: TipRow;
}

export interface TipState extends TipContent {
  x: number;
  y: number;
}

/**
 * One tooltip per chart, drawn into <body> so no card's overflow or transform can clip or shift it.
 *
 * A tap shows it the same as a hover does, and it stays a moment after the finger lifts — on a
 * phone there is no hover to keep it open, and one that vanished on release could not be read.
 */
export function useChartTip() {
  const [tip, setTip] = useState<TipState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((event: { clientX: number; clientY: number }, content: TipContent) => {
    window.clearTimeout(timer.current);
    setTip({ ...content, x: event.clientX, y: event.clientY });
  }, []);

  const hide = useCallback((event?: { pointerType?: string }) => {
    window.clearTimeout(timer.current);
    if (event?.pointerType === 'touch' || event?.pointerType === 'pen') {
      timer.current = window.setTimeout(() => setTip(null), 1800);
    } else {
      setTip(null);
    }
  }, []);

  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    // Scrolling moves the chart out from under a fixed tooltip; drop it rather than leave it adrift.
    window.addEventListener('scroll', close, { capture: true, passive: true });
    return () => window.removeEventListener('scroll', close, { capture: true });
  }, [tip]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const node = tip ? <ChartTip tip={tip} /> : null;
  return { tip, show, hide, node };
}
