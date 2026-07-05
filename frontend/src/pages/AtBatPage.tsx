import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AtBatDetailResponse, PitchDetail } from '@mlb-scorecards/shared';
import { fetchAtBat } from '../api/client';
import { StrikeZone } from '../components/StrikeZone';

function num(value: number | null, digits = 0, suffix = ''): string {
  if (value == null) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

/** Classify a pitch outcome for row tinting. */
function outcomeClass(p: PitchDetail): string {
  if (p.inPlay) return ' pitch-row-inplay';
  if (p.isBall) return ' pitch-row-ball';
  if (p.isStrike) return ' pitch-row-strike';
  return '';
}

export function AtBatPage() {
  const { gamePk, atBatIndex } = useParams<{ gamePk: string; atBatIndex: string }>();
  const [data, setData] = useState<AtBatDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gamePk || atBatIndex == null) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchAtBat(Number(gamePk), Number(atBatIndex))
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gamePk, atBatIndex]);

  const hasMovement = data?.pitches.some((p) => p.ivb != null) ?? false;

  return (
    <>
      <div className="scorecard-nav-bar">
        {/* Back to the scorecard, flashing the cell this at-bat came from. */}
        <Link to={`/game/${gamePk}?ab=${atBatIndex}`} className="scorecard-nav-back">
          ‹ Back to scorecard
        </Link>
        <span className="scorecard-nav-date">Pitch-by-pitch</span>
      </div>
      <div className="atbat-page">
        {error && <p className="status-message status-error">{error}</p>}
        {loading && <p className="status-message">Loading pitches…</p>}

        {!loading && data && (
          <>
            <div className="atbat-header">
              <div className="atbat-header-line">
                <span className="atbat-inning">
                  {data.halfInning === 'top' ? '▲ Top' : '▼ Bottom'} {data.inning}
                </span>
                <span className="atbat-code">{data.code}</span>
              </div>
              <h1 className="atbat-matchup">
                {data.pitcher} <span className="atbat-vs">to</span> {data.batter}
              </h1>
              <p className="atbat-result">{data.result}</p>
              <div className="atbat-facts">
                <span>{data.pitches.length} pitch{data.pitches.length === 1 ? '' : 'es'}</span>
                {data.rbi > 0 && <span>{data.rbi} RBI</span>}
                {data.exitVelocity != null && <span>{Math.round(data.exitVelocity)} mph EV</span>}
                {data.launchAngle != null && <span>{Math.round(data.launchAngle)}° LA</span>}
                {data.distance != null && <span>{data.distance} ft</span>}
              </div>
            </div>

            {data.pitches.length === 0 ? (
              <p className="status-message">No pitch tracking for this play.</p>
            ) : (
              <div className="atbat-body">
                <StrikeZone pitches={data.pitches} />
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
                      <th title="Count after this pitch">Count</th>
                      <th className="atbat-col-outcome">Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pitches.map((p) => (
                      <tr key={p.number} className={`atbat-row${outcomeClass(p)}`}>
                        <td>{p.number}</td>
                        <td title={p.typeDesc ?? undefined}>{p.type ?? '—'}</td>
                        <td>{num(p.velocity, 1)}</td>
                        <td>{p.spinRate != null ? Math.round(p.spinRate) : '—'}</td>
                        <td>{num(p.ivb, 1, '"')}</td>
                        <td>{num(p.ihb, 1, '"')}</td>
                        <td className="atbat-count">{p.balls}-{p.strikes}</td>
                        <td className="atbat-col-outcome">{p.outcome}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
              </div>
            )}

            {data.pitches.length > 0 && (
              hasMovement ? (
                <p className="atbat-note">
                  IVB = induced vertical break, IHB = horizontal break (inches, catcher's view). Higher IVB
                  fastballs appear to "rise"; a curveball shows strongly negative IVB.
                </p>
              ) : (
                <p className="atbat-note">
                  Pitch-movement tracking (IVB/IHB) is only available for games from 2015 onward — this game shows
                  velocity, spin, and outcome where available.
                </p>
              )
            )}
          </>
        )}
      </div>
    </>
  );
}
