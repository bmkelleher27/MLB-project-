import { useState } from 'react';
import type { PlayerProfileSide } from '@mlb-scorecards/shared';
import { PitchMixChart } from './PitchMixChart';
import { TrendChart, type TrendSeriesOption } from './TrendChart';
import { ZoneChart } from './ZoneChart';

const rate = (v: number) => (v < 1 ? v.toFixed(3).replace(/^0/, '') : v.toFixed(3));
const era = (v: number) => v.toFixed(2);
const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

const HITTING_TREND: TrendSeriesOption[] = [
  { key: 'primary', label: 'OPS', format: rate, description: 'On-base plus slugging, month by month' },
  { key: 'secondary', label: 'AVG', format: rate, description: 'Batting average, month by month' },
  { key: 'strikeoutRate', label: 'K rate', format: pct, description: 'Share of plate appearances ending in a strikeout' },
  { key: 'walkRate', label: 'BB rate', format: pct, description: 'Share of plate appearances ending in a walk' },
];

const PITCHING_TREND: TrendSeriesOption[] = [
  { key: 'primary', label: 'ERA', format: era, description: 'Earned run average, month by month' },
  { key: 'secondary', label: 'AVG against', format: rate, description: 'Opponent batting average, month by month' },
  { key: 'strikeoutRate', label: 'K rate', format: pct, description: 'Share of batters faced struck out' },
  { key: 'walkRate', label: 'BB rate', format: pct, description: 'Share of batters faced walked' },
];

export function PlayerProfileSection({
  side,
  mode,
  playerName,
}: {
  side: PlayerProfileSide;
  mode: 'batting' | 'pitching';
  playerName: string;
}) {
  const [zoneIdx, setZoneIdx] = useState(0);
  const isBatting = mode === 'batting';
  const zone = side.zones[Math.min(zoneIdx, side.zones.length - 1)];

  const first = playerName.split(' ').slice(-1)[0] || playerName;

  return (
    <section className="profile-section">
      <h2 className="player-section-title">
        {isBatting ? 'How pitchers attacked him' : 'How he attacked hitters'}
      </h2>
      <p className="profile-section-lede">
        {isBatting
          ? `Every pitch thrown to ${first} this season — what they threw, where it went, and what he did with it.`
          : `Every pitch ${first} threw this season — his mix, where he located it, and what hitters did against it.`}
      </p>

      {side.arsenal.length > 0 && (
        <PitchMixChart
          arsenal={side.arsenal}
          caption={isBatting ? 'Pitch mix he saw' : 'Pitch mix he threw'}
          subtitle={isBatting ? 'Share of pitches thrown to him' : 'Share of his pitches'}
        />
      )}

      {side.zones.length > 0 && zone && (
        <div className="profile-zone-block">
          {/* One filter row above the chart it scopes. */}
          <div className="trend-controls" role="group" aria-label="Choose zone measure">
            {side.zones.map((z, i) => (
              <button
                key={z.name}
                type="button"
                className={`trend-chip${i === zoneIdx ? ' trend-chip-on' : ''}`}
                aria-pressed={i === zoneIdx}
                onClick={() => setZoneIdx(i)}
              >
                {z.label}
              </button>
            ))}
          </div>
          <ZoneChart
            metric={zone}
            caption={
              zone.kind === 'volume'
                ? 'Location — where the pitches went'
                : isBatting
                  ? 'Damage by zone'
                  : 'Results allowed by zone'
            }
          />
          <p className="profile-zone-note">
            Catcher's view: the bordered square is the strike zone, the four surrounding
            panels are pitches off the plate.
          </p>
        </div>
      )}

      {side.splits.length > 0 && (
        <div className="profile-splits">
          <h3 className="profile-sub-title">
            {isBatting ? 'Versus left- and right-handed pitching' : 'Versus left- and right-handed hitters'}
          </h3>
          <div className="viz-table-scroll">
          <table className="viz-table profile-splits-table">
            <thead>
              <tr>
                <th>Split</th>
                <th>{isBatting ? 'PA' : 'BF'}</th>
                <th>AVG</th>
                <th>OBP</th>
                <th>SLG</th>
                <th>OPS</th>
                <th>K</th>
                <th>BB</th>
                <th>HR</th>
              </tr>
            </thead>
            <tbody>
              {side.splits.map((s, i) => (
                <tr key={s.code}>
                  <td>
                    <span className={`split-swatch split-swatch-${i % 2}`} aria-hidden="true" />
                    {s.label}
                  </td>
                  <td>{s.plateAppearances}</td>
                  <td>{s.avg}</td>
                  <td>{s.obp}</td>
                  <td>{s.slg}</td>
                  <td>{s.ops}</td>
                  <td>{s.strikeouts}</td>
                  <td>{s.walks}</td>
                  <td>{s.homeRuns}</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {side.trend.length > 1 && (
        <TrendChart
          trend={side.trend}
          options={isBatting ? HITTING_TREND : PITCHING_TREND}
          caption="Month by month"
        />
      )}
    </section>
  );
}
