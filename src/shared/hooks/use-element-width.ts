import { useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

/**
 * The rendered width of an element, kept current as it resizes.
 *
 * Charts are drawn in real pixels rather than stretched from a fixed viewBox: a stretched SVG
 * scales its text and its stroke along with its plot, so an axis label legible on a laptop turns
 * into a smear on a wide monitor and a speck on a phone. Measuring lets the chart lay out its own
 * ticks for the space it actually has.
 *
 * `fallback` is what a chart draws at before the first measurement, and what it keeps where there
 * is no ResizeObserver at all — jsdom has none, and a test should still see a chart.
 */
export function useElementWidth<T extends HTMLElement>(
  fallback = 600,
): [RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const measure = () => {
      const next = Math.round(element.getBoundingClientRect().width);
      // Zero means hidden (a closed tab, display: none); keep the last real width instead.
      if (next > 0) setWidth((current) => (current === next ? current : next));
    };

    measure();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return [ref, width];
}
