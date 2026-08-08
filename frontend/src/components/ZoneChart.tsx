import { useMemo, useState } from 'react';
import type { ZoneCell, ZoneMetric } from '@mlb-scorecards/shared';
import { divergingBin, formatZoneValue, maxDeviation, sequentialBin } from '../lib/vizScales';

/**
 * MLB's Gameday zone grid, drawn the way the broadcast shows it: the 3x3 strike
 * zone sits inside four surrounding quadrants, all from the catcher's view.
 * Geometry is fixed here so cells line up exactly with the zone codes.
 */
const BOX = 320;
const OUT_MIN = 10;
const OUT_MAX = 310;
const OUT_MID = 160;
const IN_MIN = 70;
const CELL = 60;

interface Rect {
  zone: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where to put the printed value — outer corner for the surrounding quadrants. */
  labelX: number;
  labelY: number;
}

function buildRects(): Rect[] {
  const rects: Rect[] = [];

  // Four outside quadrants. Their labels hug the outer corner so the inner
  // strike-zone grid never sits on top of them.
  const quads: Array<[string, number, number, number, number]> = [
    ['11', OUT_MIN, OUT_MIN, OUT_MID - OUT_MIN, OUT_MID - OUT_MIN],
    ['12', OUT_MID, OUT_MIN, OUT_MAX - OUT_MID, OUT_MID - OUT_MIN],
    ['13', OUT_MIN, OUT_MID, OUT_MID - OUT_MIN, OUT_MAX - OUT_MID],
    ['14', OUT_MID, OUT_MID, OUT_MAX - OUT_MID, OUT_MAX - OUT_MID],
  ];
  for (const [zone, x, y, w, h] of quads) {
    const left = x < OUT_MID;
    const top = y < OUT_MID;
    rects.push({
      zone,
      x,
      y,
      w,
      h,
      labelX: left ? x + 32 : x + w - 32,
      labelY: top ? y + 26 : y + h - 18,
    });
  }

  // The 3x3 strike zone, drawn over the quadrants.
  const inZone = ['01', '02', '03', '04', '05', '06', '07', '08', '09'];
  inZone.forEach((zone, i) => {
    const x = IN_MIN + (i % 3) * CELL;
    const y = IN_MIN + Math.floor(i / 3) * CELL;
    rects.push({ zone, x, y, w: CELL, h: CELL, labelX: x + CELL / 2, labelY: y + CELL / 2 + 5 });
  });

  return rects;
}

const RECTS = buildRects();

interface Hover {
  zone: string;
  label: string;
  value: string;
  x: number;
  y: number;
}

function zoneName(zone: string): string {
  const names: Record<string, string> = {
    '01': 'Up & in', '02': 'Up middle', '03': 'Up & away',
    '04': 'Middle in', '05': 'Middle middle', '06': 'Middle away',
    '07': 'Down & in', '08': 'Down middle', '09': 'Down & away',
    '11': 'Outside — up & in', '12': 'Outside — up & away',
    '13': 'Outside — down & in', '14': 'Outside — down & away',
  };
  return names[zone] ?? `Zone ${zone}`;
}

export function ZoneChart({ metric, caption }: { metric: ZoneMetric; caption: string }) {
  const [hover, setHover] = useState<Hover | null>(null);

  const { binFor, cellByZone, min, max, mid } = useMemo(() => {
    const cellByZone = new Map<string, ZoneCell>(metric.cells.map((c) => [c.zone, c]));
    const values = metric.cells.map((c) => c.value).filter((v): v is number => v != null);
    const min = values.length ? Math.min(...values) : 0;
    const max = values.length ? Math.max(...values) : 0;
    const mid = metric.kind === 'performance' ? (metric.reference ?? (min + max) / 2) : 0;
    const spread = maxDeviation(values, mid);
    const binFor = (v: number) =>
      metric.kind === 'volume' ? sequentialBin(v, min, max, 5) : divergingBin(v, mid, spread, 5);
    return { binFor, cellByZone, min, max, mid };
  }, [metric]);

  const scaleClass = metric.kind === 'volume' ? 'zone-seq' : 'zone-div';

  return (
    <figure className="zone-figure">
      <figcaption className="zone-caption">
        <span className="zone-caption-title">{caption}</span>
        <span className="zone-caption-sub">{metric.description}</span>
      </figcaption>

      <div className="zone-plot-wrap">
        <svg
          viewBox={`0 0 ${BOX} ${BOX}`}
          className={`zone-plot ${scaleClass}`}
          role="img"
          aria-label={`${caption}. ${metric.description}. Values are also listed in the table below.`}
        >
          {RECTS.map((r) => {
            const cell = cellByZone.get(r.zone);
            const v = cell?.value ?? null;
            const bin = v == null ? null : binFor(v);
            const text = formatZoneValue(v, metric.name);
            return (
              <g
                key={r.zone}
                className="zone-cell"
                onMouseEnter={() =>
                  setHover({
                    zone: r.zone,
                    label: zoneName(r.zone),
                    value: text,
                    x: r.x + r.w / 2,
                    y: r.y,
                  })
                }
                onMouseLeave={() => setHover(null)}
              >
                {/* A 2px surface gap between fills, drawn as an inset rather than a border. */}
                <rect
                  x={r.x + 1}
                  y={r.y + 1}
                  width={r.w - 2}
                  height={r.h - 2}
                  rx={3}
                  className={bin == null ? 'zone-rect zone-rect-empty' : `zone-rect zone-bin-${bin}`}
                />
                <text
                  x={r.labelX}
                  y={r.labelY}
                  textAnchor="middle"
                  className={bin == null ? 'zone-value zone-value-empty' : `zone-value zone-ink-${bin}`}
                >
                  {text}
                </text>
              </g>
            );
          })}
          {/* Strike-zone boundary, drawn last so it reads on top of the fills. */}
          <rect
            x={IN_MIN}
            y={IN_MIN}
            width={CELL * 3}
            height={CELL * 3}
            className="zone-strike-outline"
          />
        </svg>

        {hover && (
          <div
            className="zone-tooltip"
            style={{ left: `${(hover.x / BOX) * 100}%`, top: `${(hover.y / BOX) * 100}%` }}
            role="status"
          >
            <strong>{hover.label}</strong>
            <span>
              {metric.label}: {hover.value}
            </span>
          </div>
        )}
      </div>

      <div className="zone-legend">
        <span className="zone-legend-end">
          {metric.kind === 'volume' ? 'Fewest' : 'Below avg'}
        </span>
        <span className={`zone-legend-ramp ${scaleClass}`} aria-hidden="true">
          {[0, 1, 2, 3, 4].map((b) => (
            <span key={b} className={`zone-legend-swatch zone-bin-${b}`} />
          ))}
        </span>
        <span className="zone-legend-end">{metric.kind === 'volume' ? 'Most' : 'Above avg'}</span>
        <span className="zone-legend-note">
          {metric.kind === 'volume'
            ? `${Math.round(min)}–${Math.round(max)} pitches`
            : `midpoint ${formatZoneValue(mid, metric.name)} (own zone average)`}
        </span>
      </div>

      {/* Table twin: every value is readable without relying on color. */}
      <details className="viz-table-toggle">
        <summary>View as table</summary>
        <div className="viz-table-scroll">
        <table className="viz-table">
          <thead>
            <tr>
              <th>Zone</th>
              <th>Location</th>
              <th>{metric.label}</th>
            </tr>
          </thead>
          <tbody>
            {metric.cells.map((c) => (
              <tr key={c.zone}>
                <td>{c.zone}</td>
                <td>{zoneName(c.zone)}</td>
                <td>{formatZoneValue(c.value, metric.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </details>
    </figure>
  );
}
