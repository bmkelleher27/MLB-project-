import type { AtBatDetailResponse, PitchDetail } from '@mlb-scorecards/shared';
import { StrikeZone } from './StrikeZone';

function num(value: number | null, digits = 0, suffix = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

/** Row tint by pitch outcome, matching the strike-zone dot colors. */
function outcomeClass(p: PitchDetail): string {
  if (p.inPlay) return ' atbat-row-inplay';
  if (p.isBall) return ' atbat-row-ball';
  if (p.isStrike) return ' atbat-row-strike';
  return '';
}

/** Color the Stuff cell: plus stuff green, below-average red. */
function stuffClass(value: number): string {
  if (value >= 115) return ' atbat-stuff-high';
  if (value <= 85) return ' atbat-stuff-low';
  return '';
}

export function AtBatCard({ ab, focused }: { ab: AtBatDetailResponse; focused: boolean }) {
  return (
    <div id={`ab-${ab.atBatIndex}`} className={`atbat-card${focused ? ' atbat-card-focus' : ''}`}>
      <div className="atbat-card-head">
        <span className="atbat-code">{ab.code}</span>
        <span className="atbat-card-matchup">
          <strong>{ab.batter}</strong> <span className="atbat-vs">vs</span> {ab.pitcher}
        </span>
      </div>
      <p className="atbat-card-result">{ab.result}</p>
      <div className="atbat-facts">
        <span>{ab.pitches.length} pitch{ab.pitches.length === 1 ? '' : 'es'}</span>
        {ab.rbi > 0 && <span>{ab.rbi} RBI</span>}
        {ab.exitVelocity != null && <span>{Math.round(ab.exitVelocity)} mph EV</span>}
        {ab.launchAngle != null && <span>{Math.round(ab.launchAngle)}° LA</span>}
        {ab.distance != null && <span>{ab.distance} ft</span>}
      </div>

      {ab.pitches.length === 0 ? (
        <p className="atbat-empty">No pitch tracking for this play.</p>
      ) : (
        <div className="atbat-body">
          <StrikeZone pitches={ab.pitches} />
          <div className="atbat-table-wrapper">
            <table className="atbat-table">
              <thead>
                <tr>
                  <th title="Pitch number in the at-bat">#</th>
                  <th>Pitch</th>
                  <th title="Release speed (mph)">Velo</th>
                  <th title="Spin rate (rpm)">RPM</th>
                  <th title="Induced vertical break (inches)">IVB</th>
                  <th title="Horizontal break (inches)">IHB</th>
                  <th title="Estimated Stuff+ — pitch quality from velo, movement, and extension (100 = league average, higher = nastier)">Stuff</th>
                  <th title="Count after this pitch">Count</th>
                  <th className="atbat-col-outcome">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {ab.pitches.map((p) => (
                  <tr key={p.number} className={`atbat-row${outcomeClass(p)}`}>
                    <td>{p.number}</td>
                    <td title={p.typeDesc ?? undefined}>{p.type ?? '—'}</td>
                    <td>{num(p.velocity, 1)}</td>
                    <td>{p.spinRate != null ? Math.round(p.spinRate) : '—'}</td>
                    <td>{num(p.ivb, 1, '"')}</td>
                    <td>{num(p.ihb, 1, '"')}</td>
                    <td className={`atbat-stuff${p.stuff != null ? stuffClass(p.stuff) : ''}`}>
                      {p.stuff ?? '—'}
                    </td>
                    <td className="atbat-count">{p.balls}-{p.strikes}</td>
                    <td className="atbat-col-outcome">{p.outcome}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
