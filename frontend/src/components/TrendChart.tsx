import { useMemo, useState } from 'react';
import type { TrendPoint } from '@mlb-scorecards/shared';

const W = 640;
const H = 240;
const PAD = { top: 18, right: 22, bottom: 34, left: 46 };

export interface TrendSeriesOption {
  key: 'primary' | 'secondary' | 'strikeoutRate' | 'walkRate';
  label: string;
  /** How to print a value on the axis and in the tooltip. */
  format: (v: number) => string;
  description: string;
}

/** Nice-ish axis bounds with a little headroom, never inverted. */
function bounds(values: number[]): [number, number] {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (lo === hi) return [lo === 0 ? 0 : lo * 0.9, hi === 0 ? 1 : hi * 1.1];
  const pad = (hi - lo) * 0.15;
  return [Math.max(0, lo - pad), hi + pad];
}

/**
 * A single measure over the season's months. One measure at a time by design —
 * two different scales on one plot would invent a relationship that isn't there,
 * so switching series swaps the whole plot instead of adding a second axis.
 */
export function TrendChart({
  trend,
  options,
  caption,
}: {
  trend: TrendPoint[];
  options: TrendSeriesOption[];
  caption: string;
}) {
  const [seriesKey, setSeriesKey] = useState<TrendSeriesOption['key']>(options[0]?.key ?? 'primary');
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const option = options.find((o) => o.key === seriesKey) ?? options[0];

  const points = useMemo(
    () => trend.map((t) => ({ t, value: t[seriesKey] })).filter((p): p is { t: TrendPoint; value: number } => p.value != null),
    [trend, seriesKey]
  );

  if (!option || points.length === 0) return null;

  const [lo, hi] = bounds(points.map((p) => p.value));
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (points.length === 1 ? plotW / 2 : (i / (points.length - 1)) * plotW);
  const y = (v: number) => PAD.top + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

  const path = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p.value)}`).join(' ');
  const ticks = [lo, (lo + hi) / 2, hi];
  const last = points[points.length - 1];
  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  return (
    <figure className="trend-figure">
      <figcaption className="zone-caption">
        <span className="zone-caption-title">
          {caption} — {option.label}
        </span>
        <span className="zone-caption-sub">{option.description}</span>
      </figcaption>

      {options.length > 1 && (
        <div className="trend-controls" role="group" aria-label="Choose measure">
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`trend-chip${o.key === seriesKey ? ' trend-chip-on' : ''}`}
              aria-pressed={o.key === seriesKey}
              onClick={() => setSeriesKey(o.key)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      <div className="trend-plot-wrap">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="trend-plot"
          role="img"
          aria-label={`${option.label} by month. Values are also listed in the table below.`}
          onMouseLeave={() => setHoverIdx(null)}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="trend-grid" />
              <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" className="trend-axis-label">
                {option.format(t)}
              </text>
            </g>
          ))}

          <path d={path} className="trend-line" fill="none" />

          {points.map((p, i) => (
            <g key={p.t.month}>
              <text x={x(i)} y={H - 10} textAnchor="middle" className="trend-axis-label">
                {p.t.label}
              </text>
              <circle cx={x(i)} cy={y(p.value)} r={5} className="trend-dot" />
              {/* Generous invisible hit area — the visible dot is far too small to aim at. */}
              <rect
                x={x(i) - plotW / (points.length * 2) - 6}
                y={PAD.top}
                width={plotW / points.length + 12}
                height={plotH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
              />
            </g>
          ))}

          {hovered && (
            <line
              x1={x(hoverIdx!)}
              x2={x(hoverIdx!)}
              y1={PAD.top}
              y2={PAD.top + plotH}
              className="trend-crosshair"
            />
          )}

          {/* Direct-label the endpoint only; the axis and tooltip carry the rest. */}
          <text
            x={x(points.length - 1)}
            y={y(last.value) - 12}
            textAnchor="end"
            className="trend-endpoint-label"
          >
            {option.format(last.value)}
          </text>
        </svg>

        {hovered && (
          <div
            className="trend-tooltip"
            style={{ left: `${(x(hoverIdx!) / W) * 100}%`, top: `${(y(hovered.value) / H) * 100}%` }}
            role="status"
          >
            <strong>{hovered.t.label}</strong>
            <span>
              {option.label}: {option.format(hovered.value)}
            </span>
            <span className="trend-tooltip-sub">{hovered.t.games} games</span>
          </div>
        )}
      </div>

      <details className="viz-table-toggle">
        <summary>View as table</summary>
        <div className="viz-table-scroll">
        <table className="viz-table">
          <thead>
            <tr>
              <th>Month</th>
              <th>G</th>
              {options.map((o) => (
                <th key={o.key}>{o.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {trend.map((t) => (
              <tr key={t.month}>
                <td>{t.label}</td>
                <td>{t.games}</td>
                {options.map((o) => (
                  <td key={o.key}>{t[o.key] != null ? o.format(t[o.key]!) : '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </figure>
  );
}
