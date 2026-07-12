export function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function avg(values: number[]): number {
  return values.reduce((s, v) => s + v, 0) / values.length;
}
