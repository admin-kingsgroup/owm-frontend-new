import { useEffect, useRef } from 'react';

import { useReducedMotion } from '@/shared/hooks';

export interface CountUpProps {
  /** The figure to land on. */
  value: number;
  /** How a figure is written at every step — the same formatter the final value uses. */
  format: (value: number) => string;
  /** Milliseconds. */
  duration?: number;
}

/**
 * A headline figure that counts up to itself when it first appears or changes.
 *
 * The final value is what React renders, so the text in the DOM is always the true figure — a
 * screen reader, a test, a copy and a thumbnail all get the real number. The count is drawn over it
 * by writing the element's text directly while it runs, and ends on exactly the string React wrote.
 *
 * Skipped for anyone who asked for less motion, and wherever there is no matchMedia at all (jsdom),
 * because then there is no way to know they did not.
 */
export function CountUp({ value, format, duration = 900 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const from = useRef(0);
  const reduced = useReducedMotion();

  useEffect(() => {
    const element = ref.current;
    const start = from.current;
    from.current = value;
    if (!element || reduced || typeof window.matchMedia !== 'function' || start === value) return;

    const final = format(value);
    let frame = 0;
    const began = performance.now();

    const step = (now: number) => {
      const progress = Math.min(1, (now - began) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      element.textContent = progress < 1 ? format(start + (value - start) * eased) : final;
      if (progress < 1) frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      element.textContent = final;
    };
  }, [value, format, duration, reduced]);

  return <span ref={ref}>{format(value)}</span>;
}
