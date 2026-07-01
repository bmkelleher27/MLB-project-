import type { TeamPredictive } from '@mlb-scorecards/shared';

function indexClass(value: number): string {
  if (value >= 130) return ' pred-index-high';
  if (value <= 70) return ' pred-index-low';
  return '';
}

export function PredictiveStats({ teamName, predictive }: { teamName: string; predictive: TeamPredictive }) {
  if (predictive.batters.length === 0 && predictive.pitchers.length === 0) return null;
  const hasEV = predictive.batters.some((b) => b.avgEV != null);

  return (
    <div className="predictive-stats">
      <h3 className="predictive-title">{teamName} — predictive metrics (this game)</h3>
      <div className="predictive-tables">
        {predictive.batters.length > 0 && (
          <table className="predictive-table">
            <thead>
              <tr>
                <th className="predictive-col-name">Batter</th>
                <th>PA</th>
                <th>BB</th>
                <th>K</th>
                {hasEV && <th title="Barrels: ideal exit velocity + launch angle">Brl</th>}
                {hasEV && <th title="Batted balls 95+ mph">Hard</th>}
                {hasEV && <th title="Average exit velocity (mph)">EV</th>}
                <th title="Damage Index: expected production per PA from contact quality and discipline. 100 = league average.">
                  DMG
                </th>
              </tr>
            </thead>
            <tbody>
              {predictive.batters.map((b) => (
                <tr key={b.id}>
                  <td className="predictive-col-name">{b.name}</td>
                  <td>{b.pa}</td>
                  <td>{b.walks}</td>
                  <td>{b.strikeouts}</td>
                  {hasEV && <td>{b.barrels || ''}</td>}
                  {hasEV && <td>{b.hardHit || ''}</td>}
                  {hasEV && <td>{b.avgEV ?? ''}</td>}
                  <td className={`predictive-index${indexClass(b.dmg)}`}>{b.dmg}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {predictive.pitchers.length > 0 && (
          <table className="predictive-table">
            <thead>
              <tr>
                <th className="predictive-col-name">Pitcher</th>
                <th title="Total pitches">P</th>
                <th title="Called strikes + whiffs per pitch. League average ≈ 29%.">CSW%</th>
                {hasEV && <th title="Hard-hit balls allowed (95+ mph)">Hard</th>}
                {hasEV && <th title="Average exit velocity allowed (mph)">EV</th>}
                <th title="Dominance Index: strike-getting + contact suppression. 100 = league average.">DOM</th>
              </tr>
            </thead>
            <tbody>
              {predictive.pitchers.map((p) => (
                <tr key={p.id}>
                  <td className="predictive-col-name">{p.name}</td>
                  <td>{p.pitches}</td>
                  <td>{(p.csw * 100).toFixed(1)}</td>
                  {hasEV && <td>{p.hardHitAllowed || ''}</td>}
                  {hasEV && <td>{p.avgEVAllowed ?? ''}</td>}
                  <td className={`predictive-index${indexClass(p.dom)}`}>{p.dom}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <p className="predictive-footnote">
        <strong>DMG</strong> (batters) values each plate appearance by <em>how</em> the ball was struck — exit
        velocity + launch angle — plus walks and strikeouts, not by where it landed. <strong>DOM</strong> (pitchers)
        blends CSW% (called strikes + whiffs) with the quality of contact allowed. Both are process stats: 100 is
        league average, and they predict future performance better than the box score line.
      </p>
    </div>
  );
}
