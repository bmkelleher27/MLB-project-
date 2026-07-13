import { useMemo } from 'react';
import type { AtBatDetailResponse } from '@mlb-scorecards/shared';
import { avg } from '../lib/math';
import { pitchMeta } from '../lib/pitchTypes';

const MIN_PITCHES = 30; // starters / bulk arms only — a 12-pitch reliever has no fatigue story
const FASTBALL_FAMILY = new Set(['FF', 'FA', 'SI', 'FT', 'FC']);

function ordinal(n: number): string {
  return n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`;
}

interface SeqPitch {
  n: number; // cumulative pitch number for this pitcher
  velocity: number;
  type: string | null;
  stuff: number | null;
  outcome: string;
  batterNumber: number; // how many batters he has faced so far (1-based)
}

interface PitcherSeq {
  name: string;
  pitches: SeqPitch[];
  ttoStarts: Array<{ n: number; tto: number }>; // pitch number where the 2nd/3rd time through began
  ttos: number[]; // times through the order this pitcher actually reached
  /** Fastball-family velocity per time through the order (mixing off-speed would lie). */
  fbVeloByTto: Array<number | null>;
  /** Average Stuff per pitch type per time through the order, most-used types first. */
  stuffByType: Array<{ type: string | null; n: number; byTto: Array<number | null> }>;
}

function buildSequences(atBats: AtBatDetailResponse[]): PitcherSeq[] {
  const order: string[] = [];
  const acc = new Map<string, { pitches: SeqPitch[]; batters: number }>();

  for (const ab of atBats) {
    let a = acc.get(ab.pitcher);
    if (!a) {
      a = { pitches: [], batters: 0 };
      acc.set(ab.pitcher, a);
      order.push(ab.pitcher);
    }
    a.batters += 1;
    for (const p of ab.pitches) {
      if (p.velocity == null) continue;
      a.pitches.push({
        n: a.pitches.length + 1,
        velocity: p.velocity,
        type: p.type,
        stuff: p.stuff,
        outcome: p.outcome,
        batterNumber: a.batters,
      });
    }
  }

  return order
    .map((name) => {
      const a = acc.get(name)!;
      const ttoStarts: PitcherSeq['ttoStarts'] = [];
      for (const tto of [2, 3, 4]) {
        const first = a.pitches.find((p) => p.batterNumber > (tto - 1) * 9);
        if (first) ttoStarts.push({ n: first.n, tto });
      }
      const maxTto = Math.min(4, Math.ceil(Math.max(...a.pitches.map((p) => p.batterNumber)) / 9));
      const ttos = Array.from({ length: maxTto }, (_, i) => i + 1);
      const inTto = (p: SeqPitch, tto: number) => Math.ceil(p.batterNumber / 9) === tto;

      const fbVeloByTto = ttos.map((tto) => {
        const velos = a.pitches
          .filter((p) => inTto(p, tto) && p.type && FASTBALL_FAMILY.has(p.type))
          .map((p) => p.velocity);
        return velos.length ? avg(velos) : null;
      });

      const byType = new Map<string | null, SeqPitch[]>();
      for (const p of a.pitches) {
        if (!byType.has(p.type)) byType.set(p.type, []);
        byType.get(p.type)!.push(p);
      }
      const stuffByType = [...byType.entries()]
        .map(([type, ps]) => ({
          type,
          n: ps.length,
          byTto: ttos.map((tto) => {
            const stuffs = ps.filter((p) => inTto(p, tto)).map((p) => p.stuff).filter((v): v is number => v != null);
            return stuffs.length ? Math.round(avg(stuffs)) : null;
          }),
        }))
        .filter((row) => row.n >= 3 && row.byTto.some((v) => v != null))
        .sort((x, y) => y.n - x.n);

      return { name, pitches: a.pitches, ttoStarts, ttos, fbVeloByTto, stuffByType };
    })
    .filter((s) => s.pitches.length >= MIN_PITCHES);
}

const W = 460;
const H = 180;
const PAD_L = 34;
const PAD_R = 10;
const PAD_T = 14;
const PAD_B = 22;

function FatiguePlot({ seq }: { seq: PitcherSeq }) {
  const velos = seq.pitches.map((p) => p.velocity);
  const vMin = Math.floor(Math.min(...velos) - 1);
  const vMax = Math.ceil(Math.max(...velos) + 1);
  const total = seq.pitches.length;

  const sx = (n: number) => PAD_L + ((n - 1) / Math.max(1, total - 1)) * (W - PAD_L - PAD_R);
  const sy = (v: number) => PAD_T + ((vMax - v) / (vMax - vMin)) * (H - PAD_T - PAD_B);

  // Rolling fastball-velocity trend: the honest fatigue signal (mixing in
  // off-speed would fake a decline every breaking-ball-heavy stretch).
  const trend = useMemo(() => {
    const fbs = seq.pitches.filter((p) => p.type && FASTBALL_FAMILY.has(p.type));
    if (fbs.length < 6) return null;
    const window = 5;
    return fbs.map((p, i) => {
      const slice = fbs.slice(Math.max(0, i - window + 1), i + 1);
      return { n: p.n, v: avg(slice.map((s) => s.velocity)) };
    });
  }, [seq.pitches]);

  const yTicks: number[] = [];
  for (let v = vMin + 1; v < vMax; v += 2) yTicks.push(v);

  return (
    <figure className="fatigue-plot">
      <figcaption className="break-plot-name">
        {seq.name} <span className="break-plot-count">· {total} pitches</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${seq.name}: pitch velocity by pitch number with times-through-the-order markers`}>
        <rect x={PAD_L} y={PAD_T} width={W - PAD_L - PAD_R} height={H - PAD_T - PAD_B} className="break-plot-box" />
        {yTicks.map((v) => (
          <g key={v}>
            <line x1={PAD_L} y1={sy(v)} x2={W - PAD_R} y2={sy(v)} className="break-grid" />
            <text x={PAD_L - 4} y={sy(v) + 3} textAnchor="end" className="break-tick">{v}</text>
          </g>
        ))}
        {seq.ttoStarts.map((t) => {
          // Anchor the label away from whichever edge it would clip against.
          const nearRightEdge = sx(t.n) > W - 80;
          return (
            <g key={t.tto}>
              <line x1={sx(t.n)} y1={PAD_T} x2={sx(t.n)} y2={H - PAD_B} className="fatigue-tto-line" />
              <text
                x={nearRightEdge ? sx(t.n) - 3 : sx(t.n) + 3}
                y={PAD_T + 9}
                textAnchor={nearRightEdge ? 'end' : 'start'}
                className="break-edge"
              >
                {t.tto === 4 ? '4th' : t.tto === 3 ? '3rd' : '2nd'} time thru
              </text>
            </g>
          );
        })}
        {seq.pitches.map((p) => (
          <circle key={p.n} cx={sx(p.n)} cy={sy(p.velocity)} r={2.6} fill={pitchMeta(p.type).color} className="fatigue-dot">
            <title>{`#${p.n} ${pitchMeta(p.type).label} · ${p.velocity.toFixed(1)} mph${p.stuff != null ? ` · Stuff ${p.stuff}` : ''} — ${p.outcome}`}</title>
          </circle>
        ))}
        {trend && (
          <polyline
            points={trend.map((t) => `${sx(t.n)},${sy(t.v)}`).join(' ')}
            className="fatigue-trend"
            fill="none"
          />
        )}
        <text x={PAD_L} y={H - 6} className="break-edge">pitch 1</text>
        <text x={W - PAD_R} y={H - 6} textAnchor="end" className="break-edge">pitch {total}</text>
      </svg>
      <div className="fatigue-tto-summary">
        {seq.ttos.map((tto, i) =>
          seq.fbVeloByTto[i] != null ? (
            <span key={tto} className="fatigue-tto-chip">
              {ordinal(tto)} time thru: {seq.fbVeloByTto[i]!.toFixed(1)} mph FB
            </span>
          ) : null
        )}
      </div>
      {seq.stuffByType.length > 0 && (
        <table className="pregame-table fatigue-stuff-table">
          <thead>
            <tr>
              <th className="pregame-opp" title="Average estimated Stuff+ per pitch type, split by trip through the batting order">
                Stuff by pitch
              </th>
              {seq.ttos.map((tto) => (
                <th key={tto}>{ordinal(tto)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {seq.stuffByType.map((row) => (
              <tr key={row.type ?? 'other'}>
                <td className="pregame-opp">
                  <span className="break-swatch" style={{ background: pitchMeta(row.type).color }} aria-hidden="true" />{' '}
                  {pitchMeta(row.type).label}
                </td>
                {row.byTto.map((v, i) => (
                  <td key={i}>{v ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </figure>
  );
}

export function FatigueCharts({ atBats }: { atBats: AtBatDetailResponse[] }) {
  const seqs = useMemo(() => buildSequences(atBats), [atBats]);
  if (seqs.length === 0) return null;

  return (
    <section className="fatigue-section">
      <h2 className="atbat-inning-title">Starter fatigue</h2>
      <p className="atbat-note">
        Every pitch's velocity in the order thrown (colored by pitch type, same palette as the movement plots).
        The dark line is a rolling average of fastball-family velocity — the cleanest fatigue signal — and the
        dashed markers show where each trip through the batting order began. The chips give fastball velocity per
        trip; the table tracks each pitch type's Stuff across trips.
      </p>
      <div className="fatigue-grid">
        {seqs.map((s) => (
          <FatiguePlot key={s.name} seq={s} />
        ))}
      </div>
    </section>
  );
}
