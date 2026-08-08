import type { PitchDetail } from '@mlb-scorecards/shared';
import { avg, clamp } from '../lib/math';

// Display window in feet, catcher's view. Wide enough to show chases well
// off the plate while keeping the zone a comfortable size.
const X_MIN = -2;
const X_MAX = 2;
const Z_MIN = 0.4;
const Z_MAX = 4.6;
const W = 200;
const H = 220;
const PLATE_HALF = 0.7083; // 17-inch plate → ±0.708 ft

const xScale = W / (X_MAX - X_MIN);
const zScale = H / (Z_MAX - Z_MIN);

const sx = (ft: number) => (ft - X_MIN) * xScale;
const sy = (ft: number) => H - (ft - Z_MIN) * zScale;

/** A pitch with plate-location tracking — the only kind the zone can place. */
type Located = PitchDetail & { px: number; pz: number };

function isLocated(p: PitchDetail): p is Located {
  return p.px != null && p.pz != null;
}

function dotClass(p: PitchDetail): string {
  if (p.inPlay) return 'pitch-dot-inplay';
  if (p.isBall) return 'pitch-dot-ball';
  if (p.isStrike) return 'pitch-dot-strike';
  return 'pitch-dot-other';
}

export function StrikeZone({ pitches }: { pitches: PitchDetail[] }) {
  const located = pitches.filter(isLocated);
  if (located.length === 0) return null;

  const tops = pitches.map((p) => p.szTop).filter((v): v is number => v != null);
  const bottoms = pitches.map((p) => p.szBottom).filter((v): v is number => v != null);
  const szTop = tops.length ? avg(tops) : 3.4;
  const szBottom = bottoms.length ? avg(bottoms) : 1.6;

  const zoneX = sx(-PLATE_HALF);
  const zoneW = sx(PLATE_HALF) - zoneX;
  const zoneY = sy(szTop);
  const zoneH = sy(szBottom) - zoneY;
  const thirdW = zoneW / 3;
  const thirdH = zoneH / 3;

  // Home-plate pentagon (catcher's view) for orientation, at the bottom.
  const plateY = sy(0.55);
  const plateHalfPx = PLATE_HALF * xScale;
  const cx = sx(0);
  const plate = [
    `${cx - plateHalfPx},${plateY}`,
    `${cx + plateHalfPx},${plateY}`,
    `${cx + plateHalfPx},${plateY + 8}`,
    `${cx},${plateY + 16}`,
    `${cx - plateHalfPx},${plateY + 8}`,
  ].join(' ');

  return (
    <figure className="strike-zone">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Pitch locations in the strike zone, catcher's view">
        {/* zone with rule-of-thirds gridlines */}
        <rect x={zoneX} y={zoneY} width={zoneW} height={zoneH} className="sz-zone" />
        {[1, 2].map((i) => (
          <line key={`v${i}`} x1={zoneX + thirdW * i} y1={zoneY} x2={zoneX + thirdW * i} y2={zoneY + zoneH} className="sz-grid" />
        ))}
        {[1, 2].map((i) => (
          <line key={`h${i}`} x1={zoneX} y1={zoneY + thirdH * i} x2={zoneX + zoneW} y2={zoneY + thirdH * i} className="sz-grid" />
        ))}
        <polygon points={plate} className="sz-plate" />

        {located.map((p) => {
          const px = clamp(p.px, X_MIN + 0.12, X_MAX - 0.12);
          const pz = clamp(p.pz, Z_MIN + 0.12, Z_MAX - 0.12);
          return (
            <g key={p.number} className={`pitch-dot ${dotClass(p)}`}>
              <title>{`Pitch ${p.number}: ${p.type ?? ''} ${p.velocity != null ? `${p.velocity.toFixed(1)} mph ` : ''}— ${p.outcome}`}</title>
              <circle cx={sx(px)} cy={sy(pz)} r={9} />
              <text x={sx(px)} y={sy(pz)} textAnchor="middle" dominantBaseline="central">{p.number}</text>
            </g>
          );
        })}
      </svg>
      <figcaption className="strike-zone-caption">Catcher's view</figcaption>
    </figure>
  );
}
