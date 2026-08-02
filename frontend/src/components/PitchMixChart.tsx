import type { PitchTypeUsage } from '@mlb-scorecards/shared';

/**
 * Pitch types are nominal — reordering them wouldn't change the meaning — so
 * every bar takes the same series color and bar length alone carries magnitude.
 * The row already prints share, count and velocity, so it doubles as its own
 * table view.
 */
export function PitchMixChart({
  arsenal,
  caption,
  subtitle,
}: {
  arsenal: PitchTypeUsage[];
  caption: string;
  subtitle: string;
}) {
  if (arsenal.length === 0) return null;
  const maxShare = Math.max(...arsenal.map((a) => a.share)) || 1;
  const totalPitches = arsenal.reduce((sum, a) => sum + a.count, 0);

  return (
    <figure className="mix-figure">
      <figcaption className="zone-caption">
        <span className="zone-caption-title">{caption}</span>
        <span className="zone-caption-sub">
          {subtitle} · {totalPitches.toLocaleString()} pitches
        </span>
      </figcaption>

      <ul className="mix-list">
        {arsenal.map((p) => {
          const pct = p.share * 100;
          return (
            <li
              key={p.code}
              className="mix-row"
              title={`${p.name}: ${pct.toFixed(1)}% (${p.count} pitches)${
                p.avgSpeed ? `, averaging ${p.avgSpeed} mph` : ''
              }`}
            >
              <span className="mix-name">
                <span className="mix-code">{p.code}</span>
                <span className="mix-label">{p.name}</span>
              </span>
              <span className="mix-track">
                <span className="mix-bar" style={{ width: `${(p.share / maxShare) * 100}%` }} />
              </span>
              <span className="mix-share">{pct.toFixed(1)}%</span>
              <span className="mix-velo">{p.avgSpeed != null ? `${p.avgSpeed} mph` : '—'}</span>
            </li>
          );
        })}
      </ul>
    </figure>
  );
}
