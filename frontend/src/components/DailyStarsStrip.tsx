import { Link } from 'react-router-dom';
import type { DailyStarsResponse } from '@mlb-scorecards/shared';

function StarRow({ kind, stars }: { kind: 'DMG' | 'DOM'; stars: DailyStarsResponse['batters'] }) {
  if (stars.length === 0) return null;
  return (
    <>
      {stars.map((s) => (
        <Link key={`${kind}-${s.playerId}`} to={`/game/${s.gamePk}`} className="star-chip" title="Open that game's scorecard">
          <span className={`star-chip-index ${kind === 'DMG' ? 'star-chip-dmg' : 'star-chip-dom'}`}>
            {kind} {s.index}
          </span>
          <span className="star-chip-name">{s.name}</span>
          <span className="star-chip-meta">
            {s.teamAbbr}
            {s.line && ` · ${s.line}`}
          </span>
        </Link>
      ))}
    </>
  );
}

export function DailyStarsStrip({ stars }: { stars: DailyStarsResponse }) {
  if (stars.batters.length === 0 && stars.pitchers.length === 0) return null;
  return (
    <section className="stars-strip">
      <h2 className="landing-section-title">
        Yesterday's stars
        <Link to="/stats" className="stars-strip-hint" title="How DMG and DOM work">
          DMG / DOM · 100 = avg
        </Link>
      </h2>
      <div className="stars-strip-row">
        <StarRow kind="DMG" stars={stars.batters} />
        <StarRow kind="DOM" stars={stars.pitchers} />
      </div>
    </section>
  );
}
