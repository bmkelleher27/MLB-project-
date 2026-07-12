import { useMemo } from 'react';
import type { AtBatDetailResponse, PitchDetail } from '@mlb-scorecards/shared';
import { avg } from '../lib/math';

// Stable color + friendly label per pitch-type code. Colors are chosen to stay
// legible against both the light and dark panel backgrounds.
const PITCH_META: Record<string, { label: string; color: string }> = {
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

function meta(code: string | null): { label: string; color: string } {
  if (code && PITCH_META[code]) return PITCH_META[code];
  return { label: code ?? 'Other', color: FALLBACK_COLOR };
}

/** A pitch with both break components present — the only kind this plot can place. */
type Moved = PitchDetail & { ivb: number; ihb: number };

function hasBreak(p: PitchDetail): p is Moved {
  return p.ivb != null && p.ihb != null;
}

interface PitcherGroup {
  name: string;
  pitches: Moved[];
}

/** Group every located pitch in the game by the pitcher who threw it, in first-seen order. */
function groupByPitcher(atBats: AtBatDetailResponse[]): PitcherGroup[] {
  const order: string[] = [];
  const byName = new Map<string, Moved[]>();
  for (const ab of atBats) {
    const moved = ab.pitches.filter(hasBreak);
    if (moved.length === 0) continue;
    if (!byName.has(ab.pitcher)) {
      byName.set(ab.pitcher, []);
      order.push(ab.pitcher);
    }
    byName.get(ab.pitcher)!.push(...moved);
  }
  return order.map((name) => ({ name, pitches: byName.get(name)! }));
}

const SIZE = 200;
const PAD = 24;
const INNER = SIZE - PAD * 2;
const DOT_R = 4.2;

/** Round an absolute max up to a tidy symmetric axis extent, clamped to a sane band. */
function axisExtent(maxAbs: number): number {
  const rounded = Math.ceil(maxAbs / 5) * 5;
  return Math.min(30, Math.max(15, rounded));
}

interface LegendRow {
  code: string;
  label: string;
  color: string;
  n: number;
  velo: number | null;
}

function BreakPlot({ group, extent }: { group: PitcherGroup; extent: number }) {
  const sx = (v: number) => PAD + ((v + extent) / (2 * extent)) * INNER;
  const sy = (v: number) => PAD + ((extent - v) / (2 * extent)) * INNER; // +IVB points up

  const ticks: number[] = [];
  for (let t = -extent; t <= extent; t += 10) ticks.push(t);

  // Legend: one row per pitch type this pitcher threw, most-used first.
  const legend = useMemo<LegendRow[]>(() => {
    const byType = new Map<string, Moved[]>();
    for (const p of group.pitches) {
      const key = p.type ?? '—';
      if (!byType.has(key)) byType.set(key, []);
      byType.get(key)!.push(p);
    }
    return [...byType.entries()]
      .map(([code, ps]) => {
        const m = meta(code === '—' ? null : code);
        const velos = ps.map((p) => p.velocity).filter((v): v is number => v != null);
        return { code, label: m.label, color: m.color, n: ps.length, velo: velos.length ? avg(velos) : null };
      })
      .sort((a, b) => b.n - a.n);
  }, [group.pitches]);

  const label = `${group.name} pitch movement: induced vertical break versus horizontal break, one dot per pitch, colored by pitch type`;

  return (
    <figure className="break-plot">
      <figcaption className="break-plot-name">
        {group.name} <span className="break-plot-count">· {group.pitches.length} pitches</span>
      </figcaption>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
        <rect x={PAD} y={PAD} width={INNER} height={INNER} className="break-plot-box" />
        {ticks.map((t) => (
          <g key={`t${t}`}>
            <line x1={sx(t)} y1={PAD} x2={sx(t)} y2={PAD + INNER} className={t === 0 ? 'break-axis' : 'break-grid'} />
            <line x1={PAD} y1={sy(t)} x2={PAD + INNER} y2={sy(t)} className={t === 0 ? 'break-axis' : 'break-grid'} />
            {t !== 0 && (
              <>
                <text x={sx(t)} y={PAD + INNER + 10} textAnchor="middle" className="break-tick">{t}</text>
                <text x={PAD - 4} y={sy(t) + 3} textAnchor="end" className="break-tick">{t}</text>
              </>
            )}
          </g>
        ))}
        {/* orientation hints (catcher's view: +IHB is toward third base) */}
        <text x={PAD} y={PAD - 8} className="break-edge" textAnchor="start">1B ◄</text>
        <text x={PAD + INNER} y={PAD - 8} className="break-edge" textAnchor="end">► 3B</text>

        {group.pitches.map((p, i) => {
          const m = meta(p.type);
          const x = sx(Math.max(-extent, Math.min(extent, p.ihb)));
          const y = sy(Math.max(-extent, Math.min(extent, p.ivb)));
          return (
            <circle key={i} cx={x} cy={y} r={DOT_R} fill={m.color} className="break-dot">
              <title>{`${m.label}${p.velocity != null ? ` · ${p.velocity.toFixed(1)} mph` : ''} · IVB ${p.ivb.toFixed(1)}" · IHB ${p.ihb.toFixed(1)}"`}</title>
            </circle>
          );
        })}
      </svg>
      <div className="break-axis-labels">
        <span>↕ vertical · ↔ horizontal break (in) — catcher's view</span>
      </div>
      <ul className="break-legend">
        {legend.map((row) => (
          <li key={row.code}>
            <span className="break-swatch" style={{ background: row.color }} aria-hidden="true" />
            <span className="break-legend-label">{row.label}</span>
            <span className="break-legend-meta">
              {row.n}
              {row.velo != null && <> · {row.velo.toFixed(0)} mph</>}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

export function PitchMovementPlots({ atBats }: { atBats: AtBatDetailResponse[] }) {
  const groups = useMemo(() => groupByPitcher(atBats), [atBats]);

  const extent = useMemo(() => {
    let maxAbs = 0;
    for (const g of groups) {
      for (const p of g.pitches) {
        maxAbs = Math.max(maxAbs, Math.abs(p.ivb), Math.abs(p.ihb));
      }
    }
    return axisExtent(maxAbs || 20);
  }, [groups]);

  if (groups.length === 0) return null;

  return (
    <section className="break-plots-section">
      <h2 className="atbat-inning-title">Pitch movement by pitcher</h2>
      <p className="atbat-note">
        Each pitcher's arsenal plotted as induced vertical break (up = ride) versus horizontal break
        (catcher's view — right is the third-base side), one dot per pitch, colored by pitch type. Tight
        clusters mean a repeatable pitch; wide vertical/horizontal separation between types is what makes an
        arsenal play up.
      </p>
      <div className="break-plots-grid">
        {groups.map((g) => (
          <BreakPlot key={g.name} group={g} extent={extent} />
        ))}
      </div>
    </section>
  );
}
