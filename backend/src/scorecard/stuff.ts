/**
 * An estimated "Stuff+"-style pitch-quality index.
 *
 * Real Stuff+ (FanGraphs / Baseball Prospectus / PitchingBot) is a proprietary
 * gradient-boosted model trained on years of pitch-level run values. The MLB
 * API does not expose it, but it does expose the physical inputs those models
 * learn from. This is a transparent heuristic over those same inputs — release
 * speed, movement, and extension — graded against per-pitch-type league
 * references, scaled so 100 = league average and higher = nastier (SD ~10-12,
 * so 115+ is plus stuff, 85- is below). It is an approximation, not the
 * trademarked metric, and deliberately ignores velocity separation and
 * sequencing which the real models capture.
 */

interface StuffRef {
  vMean: number;
  vSD: number;
  /** "Good movement" scalar for this family (higher = nastier), in inches. */
  move: (ivb: number, ihb: number) => number;
  mMean: number;
  mSD: number;
  wV: number; // velocity weight
  wM: number; // movement weight
  wE: number; // extension weight
}

const EXT_MEAN = 6.4;
const EXT_SD = 0.5;

// League-ish reference means/spreads per pitch family (approximate, recent MLB).
// The "move" function encodes which movement is good for that family, using
// |ihb| so the grade is handedness-agnostic.
const REFS: Record<string, StuffRef> = {
  fastball: { vMean: 93.5, vSD: 2.5, move: (ivb) => ivb, mMean: 15.5, mSD: 3.0, wV: 0.45, wM: 0.4, wE: 0.15 },
  sinker: { vMean: 93.0, vSD: 2.3, move: (ivb, ihb) => Math.abs(ihb) + Math.max(0, 14 - ivb) * 0.4, mMean: 16, mSD: 4, wV: 0.45, wM: 0.4, wE: 0.15 },
  cutter: { vMean: 89.0, vSD: 2.5, move: (ivb, ihb) => Math.abs(ihb) + Math.max(0, 10 - ivb) * 0.3, mMean: 5, mSD: 2.5, wV: 0.45, wM: 0.4, wE: 0.15 },
  slider: { vMean: 85.0, vSD: 3.0, move: (ivb, ihb) => Math.abs(ihb) + Math.max(0, 5 - ivb) * 0.2, mMean: 8, mSD: 4, wV: 0.35, wM: 0.55, wE: 0.1 },
  curve: { vMean: 79.0, vSD: 3.0, move: (ivb, ihb) => Math.max(0, -ivb) + Math.abs(ihb), mMean: 18, mSD: 5, wV: 0.3, wM: 0.6, wE: 0.1 },
  change: { vMean: 85.0, vSD: 3.0, move: (ivb, ihb) => Math.abs(ihb) + Math.max(0, 12 - ivb) * 0.6, mMean: 16, mSD: 4, wV: 0.3, wM: 0.6, wE: 0.1 },
  split: { vMean: 85.0, vSD: 3.0, move: (ivb, ihb) => Math.abs(ihb) + Math.max(0, 10 - ivb) * 0.8, mMean: 14, mSD: 4, wV: 0.3, wM: 0.6, wE: 0.1 },
};

const FAMILY: Record<string, keyof typeof REFS> = {
  FF: 'fastball', FA: 'fastball',
  SI: 'sinker', FT: 'sinker',
  FC: 'cutter',
  SL: 'slider', ST: 'slider', SV: 'slider', SC: 'slider',
  CU: 'curve', KC: 'curve', CS: 'curve', CB: 'curve',
  CH: 'change',
  FS: 'split', FO: 'split',
  // KN knuckleball, EP eephus, PO pitchout, IN intentional — no grade.
};

function clampZ(z: number): number {
  return Math.max(-3, Math.min(3, z));
}

/**
 * Estimated Stuff+ for a single pitch, or null when the pitch type isn't
 * gradeable or the movement inputs are missing (e.g. pre-2015 games).
 */
export function computeStuff(
  type: string | null,
  velocity: number | null,
  ivb: number | null,
  ihb: number | null,
  extension: number | null
): number | null {
  if (!type) return null;
  const family = FAMILY[type];
  if (!family) return null;
  if (velocity == null || ivb == null || ihb == null) return null;

  const r = REFS[family];
  const zV = clampZ((velocity - r.vMean) / r.vSD);
  const zM = clampZ((r.move(ivb, ihb) - r.mMean) / r.mSD);
  const zE = extension != null ? clampZ((extension - EXT_MEAN) / EXT_SD) : 0;

  const raw = r.wV * zV + r.wM * zM + r.wE * zE;
  const stuff = Math.round(100 + 20 * raw);
  return Math.max(40, Math.min(175, stuff));
}
