import { useState } from 'react';
import type { Scorecard, TeamScorecard, TeamTotals } from '@mlb-scorecards/shared';
import { formatFullDate } from '../lib/date';
import { getTeamColor, getTeamHex } from '../teamColors';
import { LogoMark } from './Logo';
import { PitchingTable } from './PitchingTable';
import { ScorecardTable } from './ScorecardTable';

/** Compact self-documenting key so the printed card explains its own shorthand. */
const LEGEND: Array<[string, string]> = [
  ['K / ꓘ', 'strikeout (swinging / looking)'],
  ['6-3', 'groundout, SS to 1B'],
  ['F8', 'flyout to CF'],
  ['1B–7', 'single, fielded by LF'],
  ['BB', 'walk'],
  ['HR', 'home run'],
  ['SB', 'stolen base'],
  ['◇', 'bases reached (filled = scored)'],
];

const NEUTRAL_HEX = '#64748b';

/** Team logo on a white chip, falling back to a team-color dot if it fails. */
function TeamLogo({ teamId }: { teamId: number }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="print-logo-chip">
      {failed ? (
        <span className="print-logo-dot" style={{ background: getTeamHex(teamId) ?? NEUTRAL_HEX }} />
      ) : (
        <img
          src={`https://www.mlbstatic.com/team-logos/${teamId}.svg`}
          alt=""
          width={20}
          height={20}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

function ScoreBugRow({
  team,
  runs,
  winner,
}: {
  team: TeamScorecard['team'];
  runs: number;
  winner: boolean;
}) {
  return (
    <div className={`print-bug-row${winner ? ' print-bug-row-win' : ''}`}>
      <span className="print-bug-bar" style={{ background: getTeamHex(team.id) ?? NEUTRAL_HEX }} />
      <TeamLogo teamId={team.id} />
      <span className="print-bug-name">{team.name}</span>
      <span className="print-bug-score">{runs}</span>
    </div>
  );
}

function LineScore({ scorecard }: { scorecard: Scorecard }) {
  const innings = scorecard.linescore;
  const row = (side: 'away' | 'home') => (
    <tr>
      <td className="print-ls-abbr">{scorecard.teams[side].team.abbreviation}</td>
      {innings.map((l) => (
        <td key={l.num}>{l[side].runs}</td>
      ))}
      <td className="print-ls-tot print-ls-runs">{scorecard.totals[side].r}</td>
      <td className="print-ls-tot">{scorecard.totals[side].h}</td>
      <td className="print-ls-tot">{scorecard.totals[side].e}</td>
    </tr>
  );
  return (
    <table className="print-linescore">
      <thead>
        <tr>
          <th />
          {innings.map((l) => (
            <th key={l.num}>{l.num}</th>
          ))}
          <th className="print-ls-tot">R</th>
          <th className="print-ls-tot">H</th>
          <th className="print-ls-tot">E</th>
        </tr>
      </thead>
      <tbody>
        {row('away')}
        {row('home')}
      </tbody>
    </table>
  );
}

function TeamBand({ team, totals, side }: { team: TeamScorecard; totals: TeamTotals; side: 'AWAY' | 'HOME' }) {
  const color = getTeamColor(team.team.id);
  return (
    <div className="print-team-band" style={{ background: color.bg, color: color.text }}>
      <TeamLogo teamId={team.team.id} />
      <span className="print-team-band-side">{side}</span>
      <span className="print-team-band-name">{team.team.name}</span>
      <span className="print-team-band-line">
        {totals.r} R · {totals.h} H · {totals.e} E
      </span>
    </div>
  );
}

export function PrintScorecard({ scorecard }: { scorecard: Scorecard }) {
  const seasonYear = scorecard.date ? Number(scorecard.date.slice(0, 4)) : null;
  const awayR = scorecard.totals.away.r;
  const homeR = scorecard.totals.home.r;
  const isFinal = scorecard.status.abstractGameState === 'Final';
  const statusLabel = isFinal
    ? 'FINAL'
    : scorecard.status.abstractGameState === 'Live'
      ? `LIVE · ${scorecard.halfInning === 'top' ? '▲' : '▼'} ${scorecard.inning}`
      : scorecard.status.detailedState;

  const team = (side: 'away' | 'home') => (
    <section className="print-team" data-side={side}>
      <TeamBand
        team={scorecard.teams[side]}
        totals={scorecard.totals[side]}
        side={side === 'away' ? 'AWAY' : 'HOME'}
      />
      <ScorecardTable
        team={scorecard.teams[side]}
        linescore={scorecard.linescore}
        totals={scorecard.totals[side]}
        side={side}
        seasonYear={seasonYear}
      />
      <PitchingTable
        teamName={scorecard.teams[side].team.name}
        pitching={scorecard.teams[side].pitching}
        seasonYear={seasonYear}
      />
    </section>
  );

  return (
    <div className="print-scorecard">
      <header className="print-masthead">
        <div className="print-brand-bar">
          <span className="print-wordmark">
            <LogoMark size={18} />
            MLB LIVE SCORECARDS
          </span>
          <span className="print-meta">
            {scorecard.date ? formatFullDate(scorecard.date) : ''}
            {scorecard.venue ? ` · ${scorecard.venue}` : ''}
          </span>
        </div>
        <div className="print-scorebug">
          <div className="print-bug-teams">
            <ScoreBugRow team={scorecard.teams.away.team} runs={awayR} winner={isFinal && awayR > homeR} />
            <ScoreBugRow team={scorecard.teams.home.team} runs={homeR} winner={isFinal && homeR > awayR} />
          </div>
          <div className="print-bug-line">
            <span className="print-bug-status">{statusLabel}</span>
            <LineScore scorecard={scorecard} />
          </div>
        </div>
      </header>

      {team('away')}
      {team('home')}

      <div className="print-legend">
        <span className="print-legend-title">Scoring key</span>
        {LEGEND.map(([code, meaning]) => (
          <span key={code} className="print-legend-item">
            <span className="print-legend-code">{code}</span> {meaning}
          </span>
        ))}
      </div>
      <div className="print-footer">
        Generated by MLB Live Scorecards · {new Date().toLocaleDateString('en-US', { dateStyle: 'medium' } as Intl.DateTimeFormatOptions)} · Data: MLB Stats API
      </div>
    </div>
  );
}
