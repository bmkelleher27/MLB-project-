/**
 * Bin selection for the player heat maps.
 *
 * Colors themselves live in CSS custom properties (one set per theme), so this
 * module only ever decides *which* bin a value falls in — the light/dark hexes
 * swap in one place and no component hardcodes a color.
 *
 * Five bins deliberately: past ~7 color classes adjacent bins stop being
 * distinguishable, and every cell also carries its printed value.
 */
export const BIN_COUNT = 5;

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/**
 * Magnitude scale (pitch counts): low values land in bin 0 and recede toward
 * the surface, high values in the last bin.
 */
export function sequentialBin(value: number, min: number, max: number, bins = BIN_COUNT): number {
  if (!Number.isFinite(value) || bins < 1) return 0;
  if (max <= min) return Math.floor((bins - 1) / 2);
  const t = clamp((value - min) / (max - min), 0, 1);
  // t === 1 would round up past the last bin.
  return Math.min(bins - 1, Math.floor(t * bins));
}

/**
 * Polarity scale around a midpoint (a player's own across-zone average).
 * Bin 2 is the neutral middle; 0/1 sit below the midpoint, 3/4 above.
 * `spread` is the largest absolute deviation on the grid, so the ramp always
 * uses its full range for whoever is being looked at.
 */
export function divergingBin(value: number, mid: number, spread: number, bins = BIN_COUNT): number {
  const middle = Math.floor((bins - 1) / 2);
  if (!Number.isFinite(value) || !Number.isFinite(mid)) return middle;
  if (!Number.isFinite(spread) || spread <= 0) return middle;
  const ratio = clamp((value - mid) / spread, -1, 1);
  if (ratio <= -0.5) return 0;
  if (ratio <= -0.15) return 1;
  if (ratio < 0.15) return 2;
  if (ratio < 0.5) return 3;
  return 4;
}

/** Largest absolute distance from `mid` across the values — the diverging half-range. */
export function maxDeviation(values: number[], mid: number): number {
  let max = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    max = Math.max(max, Math.abs(v - mid));
  }
  return max;
}

/** Formats a rate stat the way a scorebook would: ".333", "1.250", "91.9". */
export function formatZoneValue(value: number | null, metric: string): string {
  if (value == null) return '—';
  if (metric === 'exitVelocity') return value.toFixed(1);
  if (metric === 'numberOfPitches' || metric === 'numberOfStrikes') return String(Math.round(value));
  if (metric === 'earnedRunAverage') return value.toFixed(2);
  // Rate stats drop the leading zero, except when they exceed 1.000 (e.g. OPS).
  const fixed = value.toFixed(3);
  return value < 1 ? fixed.replace(/^0/, '') : fixed;
}
