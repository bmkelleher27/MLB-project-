// Stable color + friendly label per pitch-type code. Colors are chosen to stay
// legible against both the light and dark panel backgrounds.
export const PITCH_META: Record<string, { label: string; color: string }> = {
  FF: { label: '4-Seam', color: '#d7263d' },
  FA: { label: 'Fastball', color: '#d7263d' },
  SI: { label: 'Sinker', color: '#f46036' },
  FT: { label: '2-Seam', color: '#f46036' },
  FC: { label: 'Cutter', color: '#9b59b6' },
  SL: { label: 'Slider', color: '#2e86de' },
  ST: { label: 'Sweeper', color: '#17a2b8' },
  SV: { label: 'Slurve', color: '#138d75' },
  CU: { label: 'Curve', color: '#27ae60' },
  KC: { label: 'Knuckle-Curve', color: '#2ecc71' },
  CS: { label: 'Slow Curve', color: '#58d68d' },
  CH: { label: 'Changeup', color: '#e1a100' },
  FS: { label: 'Splitter', color: '#e67e22' },
  FO: { label: 'Forkball', color: '#d35400' },
  KN: { label: 'Knuckleball', color: '#7f8c8d' },
  EP: { label: 'Eephus', color: '#95a5a6' },
  SC: { label: 'Screwball', color: '#c0392b' },
};

const FALLBACK_COLOR = '#8895a7';

export function pitchMeta(code: string | null): { label: string; color: string } {
  if (code && PITCH_META[code]) return PITCH_META[code];
  return { label: code ?? 'Other', color: FALLBACK_COLOR };
}

