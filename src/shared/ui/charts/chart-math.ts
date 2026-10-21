/**
 * Round ticks for an axis: 0, 20L, 40L… rather than 0, 17.3L, 34.6L.
 *
 * Every tick is a value the axis actually reaches, so a label never names a level the plot does
 * not draw to.
 */
export function niceScale(min: number, max: number, count = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { lo: 0, hi: 1, ticks: [0, 1] };
  if (min === max) max = min === 0 ? 1 : min + Math.abs(min) * 0.5;
  const rough = (max - min) / count;
  const magnitude = Math.pow(10, Math.floor(Math.log10(rough)));
  const ratio = rough / magnitude;
  const step = (ratio >= 7.5 ? 10 : ratio >= 3.5 ? 5 : ratio >= 1.5 ? 2 : 1) * magnitude;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = lo; value <= hi + step / 2; value += step)
    ticks.push(Number(value.toPrecision(12)));
  return { lo, hi, ticks };
}

/** A column with only its data end rounded — the baseline end stays square, anchored to the axis. */
export function roundedColumn(x: number, top: number, width: number, base: number, radius = 4) {
  const height = Math.abs(base - top);
  if (height < 0.5) return '';
  const r = Math.min(radius, width / 2, height);
  if (top <= base) {
    return `M${x},${base}L${x},${top + r}Q${x},${top} ${x + r},${top}L${x + width - r},${top}Q${x + width},${top} ${x + width},${top + r}L${x + width},${base}Z`;
  }
  // Below the axis: round the bottom end instead.
  return `M${x},${base}L${x},${top - r}Q${x},${top} ${x + r},${top}L${x + width - r},${top}Q${x + width},${top} ${x + width},${top - r}L${x + width},${base}Z`;
}
