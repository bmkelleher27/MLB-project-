import type { PitchTypeUsage } from '@mlb-scorecards/shared';

/** Rate stats print scorebook-style: ".214", "1.125". */
function rate(v: number | null): string {
  if (v == null) return '—';
  const fixed = v.toFixed(3);
  return v < 1 ? fixed.replace(/^0/, '') : fixed;
}

function percent(v: number | null): string {
  return v == null ? '—' : `${Math.round(v * 100)}%`;
}

/**
 * Pitch types are nominal — reordering them wouldn't change the meaning — so
 * every bar takes the same series color and bar length alone carries usage.
 * The performance columns sit beside the bar so "what they threw" and "what
 * happened" read together. Every value is printed, so the card is its own
 * table view.
 */
export function PitchMixChart({
  arsenal,
  caption,
  subtitle,
  isBatting,
}: {
  arsenal: PitchTypeUsage[];
  caption: string;
  subtitle: string;
  isBatting: boolean;
}) {
  if (arsenal.length === 0) return null;
  const maxShare = Math.max(...arsenal.map((a) => a.share)) || 1;
  const totalPitches = arsenal.reduce((sum, a) => sum + a.count, 0);
  const hasPerformance = arsenal.some((a) => a.performance);
  const anyLowSample = arsenal.some((a) => a.performance?.lowSample);

  return (
    <figure className="mix-figure">
      <figcaption className="zone-caption">
        <span className="zone-caption-title">{caption}</span>
        <span className="zone-caption-sub">
          {subtitle} · {totalPitches.toLocaleString()} pitches
        </span>
      </figcaption>

      <div className={`mix-grid${hasPerformance ? ' mix-grid-perf' : ''}`}>
        <div className="mix-row mix-head" aria-hidden="true">
          <span className="mix-name">Pitch</span>
          <span className="mix-track-head">Usage</span>
          <span className="mix-share">%</span>
          <span className="mix-velo">Velo</span>
          {hasPerformance && (
            <>
              <span className="mix-stat" title={isBatting ? 'Batting average' : 'Batting average allowed'}>
                AVG
              </span>
              <span className="mix-stat" title={isBatting ? 'Slugging percentage' : 'Slugging allowed'}>
                SLG
              </span>
              <span className="mix-stat" title="Swings that missed, as a share of swings">
                Whiff
              </span>
            </>
          )}
        </div>

        <ul className="mix-list">
          {arsenal.map((p) => {
            const pct = p.share * 100;
            const perf = p.performance;
            const detail = [
              `${pct.toFixed(1)}% (${p.count} pitches)`,
              p.avgSpeed ? `${p.avgSpeed} mph` : null,
              perf && !perf.lowSample
                ? `${rate(perf.avg)}/${rate(perf.slg)} in ${perf.atBats} AB`
                : perf
                  ? `only ${perf.atBats} AB — too few to rate`
                  : null,
              perf?.whiffRate != null ? `${percent(perf.whiffRate)} whiff on ${perf.swings} swings` : null,
            ]
              .filter(Boolean)
              .join(' · ');

            return (
              <li key={p.code} className="mix-row" title={`${p.name}: ${detail}`}>
                <span className="mix-name">
                  <span className="mix-code">{p.code}</span>
                  <span className="mix-label">{p.name}</span>
                </span>
                <span className="mix-track">
                  <span className="mix-bar" style={{ width: `${(p.share / maxShare) * 100}%` }} />
                </span>
                <span className="mix-share">{pct.toFixed(1)}%</span>
                <span className="mix-velo">{p.avgSpeed != null ? `${p.avgSpeed} mph` : '—'}</span>
                {hasPerformance && (
                  <>
                    <span className={`mix-stat${perf?.lowSample ? ' mix-stat-thin' : ''}`}>
                      {rate(perf?.avg ?? null)}
                    </span>
                    <span className={`mix-stat${perf?.lowSample ? ' mix-stat-thin' : ''}`}>
                      {rate(perf?.slg ?? null)}
                    </span>
                    <span className="mix-stat">{percent(perf?.whiffRate ?? null)}</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {hasPerformance && (
        <p className="mix-note">
          AVG and SLG are credited to the pitch that <em>ended</em> the plate appearance; whiff rate
          is measured over every pitch{isBatting ? ' seen' : ' thrown'}, so the two use different
          denominators. Plate appearances ending on a pitch MLB left unclassified — a pitch-timer
          violation, say — are excluded, so the at-bats here can total slightly under the season line.
          {anyLowSample && ' A dash means too few at-bats to rate.'}
        </p>
      )}

      {/* Table twin: narrow layouts drop columns and phones have no hover, so
          every number stays reachable here at any width. */}
      {hasPerformance && (
        <details className="viz-table-toggle">
          <summary>View as table</summary>
          <div className="viz-table-scroll">
            <table className="viz-table">
              <thead>
                <tr>
                  <th>Pitch</th>
                  <th>Pitches</th>
                  <th>Usage</th>
                  <th>Velo</th>
                  <th>PA</th>
                  <th>AB</th>
                  <th>AVG</th>
                  <th>SLG</th>
                  <th>K%</th>
                  <th>Swings</th>
                  <th>Whiff%</th>
                </tr>
              </thead>
              <tbody>
                {arsenal.map((p) => (
                  <tr key={p.code}>
                    <td>
                      {p.name} <span className="mix-code">{p.code}</span>
                    </td>
                    <td>{p.count}</td>
                    <td>{(p.share * 100).toFixed(1)}%</td>
                    <td>{p.avgSpeed != null ? p.avgSpeed : '—'}</td>
                    <td>{p.performance?.plateAppearances ?? '—'}</td>
                    <td>{p.performance?.atBats ?? '—'}</td>
                    <td>{rate(p.performance?.avg ?? null)}</td>
                    <td>{rate(p.performance?.slg ?? null)}</td>
                    <td>{percent(p.performance?.strikeoutRate ?? null)}</td>
                    <td>{p.performance?.swings ?? '—'}</td>
                    <td>{percent(p.performance?.whiffRate ?? null)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </figure>
  );
}
