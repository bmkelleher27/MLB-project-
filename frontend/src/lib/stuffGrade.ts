/**
 * Grade bands for the estimated Stuff+ scale (100 = league average).
 * Mirrors scouting-scale language: plus, plus-plus, average, below average.
 */
export interface StuffGrade {
  /** Human label, e.g. "plus-plus". */
  label: string;
  /** Compact suffix rendered next to the number: "++", "+", "", "−". */
  symbol: string;
  className: string;
}

export const STUFF_BANDS: Array<{ range: string; symbol: string; label: string }> = [
  { range: '130+', symbol: '++', label: 'plus-plus' },
  { range: '115–129', symbol: '+', label: 'plus' },
  { range: '85–114', symbol: '', label: 'average' },
  { range: '< 85', symbol: '−', label: 'below average' },
];

export const STUFF_BANDS_TEXT = '130+ plus-plus (++) · 115–129 plus (+) · 85–114 average · below 85 below average (−)';

export function stuffGrade(value: number): StuffGrade {
  if (value >= 130) return { label: 'plus-plus', symbol: '++', className: ' stuff-plusplus' };
  if (value >= 115) return { label: 'plus', symbol: '+', className: ' stuff-plus' };
  if (value >= 85) return { label: 'average', symbol: '', className: '' };
  return { label: 'below average', symbol: '−', className: ' stuff-below' };
}
