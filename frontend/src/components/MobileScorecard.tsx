import { useMemo, useState } from 'react';
import type { Cell, Scorecard, TeamScorecard } from '@mlb-scorecards/shared';
import { progressFromCell } from '../lib/diamond';
import { Diamond } from './Diamond';

function allCells(team: TeamScorecard): Cell[] {
  return Object.values(team.cellsBySlot).flat();
}

interface HalfInning {
  key: string;
  inning: number;
  half: 'top' | 'bottom';
  teamName: string;
  runs: number;
  hits: number;
  cells: Cell[];
}

/** All plate appearances, in game order, grouped into half-innings. */
function buildHalfInnings(sc: Scorecard): HalfInning[] {
  const cells = [...allCells(sc.teams.away), ...allCells(sc.teams.home)].sort(
    (a, b) => a.atBatIndex - b.atBatIndex
  );
  const map = new Map<string, HalfInning>();
  const order: string[] = [];
  for (const c of cells) {
    const key = `${c.inning}-${c.halfInning}`;
    if (!map.has(key)) {
      const side = c.halfInning === 'top' ? 'away' : 'home';
      const line = sc.linescore.find((l) => l.num === c.inning);
      map.set(key, {
        key,
        inning: c.inning,
        half: c.halfInning,
        teamName: sc.teams[side].team.name,
        runs: line ? line[side].runs : 0,
        hits: line ? line[side].hits : 0,
        cells: [],
      });
      order.push(key);
    }
    map.get(key)!.cells.push(c);
  }
  return order.map((k) => map.get(k)!);
}

function orderMap(sc: Scorecard): Map<number, number> {
  const m = new Map<number, number>();
  for (const side of ['away', 'home'] as const) {
    for (const slot of sc.teams[side].lineup) {
      for (const p of slot.players) m.set(p.id, slot.slot);
    }
  }
  return m;
}

function PlayRow({ cell, order, onOpen }: { cell: Cell; order?: number; onOpen: (i: number) => void }) {
  const progress = progressFromCell(cell);
  const scored = progress.base === 4 && !progress.isOut;
  const out = cell.isOut || progress.isOut;
  const stateClass = scored ? ' mscore-play-scored' : out ? ' mscore-play-out' : '';
  return (
    <button
      className={`mscore-play${stateClass}`}
      onClick={() => onOpen(cell.atBatIndex)}
      aria-label={`${cell.batterName}: ${cell.description}`}
    >
      {order != null && <span className="mscore-play-order">{order}</span>}
      <span className="mscore-play-body">
        <span className="mscore-play-top">
          <span className="mscore-play-batter">{cell.batterName}</span>
          <span className="mscore-play-code">{cell.code}</span>
        </span>
        <span className="mscore-play-desc">{cell.description}</span>
        <span className="mscore-play-meta">
          <span className="mscore-play-count">
            {cell.count.balls}-{cell.count.strikes}
          </span>
          {cell.rbi > 0 && <span className="mscore-badge mscore-badge-rbi">{cell.rbi} RBI</span>}
          {cell.isOut && cell.outNumber && <span className="mscore-badge mscore-badge-out">Out {cell.outNumber}</span>}
        </span>
      </span>
      <span className="mscore-play-diamond">
        <Diamond progress={progress} advancement={cell.advancement} />
      </span>
    </button>
  );
}

function InningsFeed({ sc, onOpen }: { sc: Scorecard; onOpen: (i: number) => void }) {
  const halves = useMemo(() => buildHalfInnings(sc), [sc]);
  const orders = useMemo(() => orderMap(sc), [sc]);

  if (halves.length === 0) {
    return <p className="status-message">No plays yet.</p>;
  }

  return (
    <div className="mscore-feed">
      {halves.map((h) => (
        <section key={h.key} className="mscore-half">
          <header className="mscore-half-head">
            <span className="mscore-half-label">
              {h.half === 'top' ? '▲ Top' : '▼ Bottom'} {h.inning}
            </span>
            <span className="mscore-half-team">{h.teamName}</span>
            <span className="mscore-half-runs">
              {h.runs} R · {h.hits} H
            </span>
          </header>
          {h.cells.map((c) => (
            <PlayRow key={c.atBatIndex} cell={c} order={orders.get(c.batterId)} onOpen={onOpen} />
          ))}
        </section>
      ))}
    </div>
  );
}

function LineupBlock({ team, onOpen }: { team: TeamScorecard; onOpen: (i: number) => void }) {
  return (
    <div className="mscore-lineup">
      <h3 className="mscore-lineup-title">{team.team.name}</h3>
      {team.lineup.map((slot) => (
        <div key={slot.slot} className="mscore-lineup-row">
          <span className="mscore-lineup-slot">{slot.slot}</span>
          <span className="mscore-lineup-name">{slot.players.map((p) => p.name).join(' / ')}</span>
          <span className="mscore-lineup-cells">
            {(team.cellsBySlot[slot.slot] ?? []).map((c) => {
              const p = progressFromCell(c);
              const scored = p.base === 4 && !p.isOut;
              const out = c.isOut || p.isOut;
              return (
                <button
                  key={c.atBatIndex}
                  className={`mscore-chip${scored ? ' mscore-chip-scored' : out ? ' mscore-chip-out' : ''}`}
                  onClick={() => onOpen(c.atBatIndex)}
                  title={c.description}
                >
                  {c.code}
                </button>
              );
            })}
          </span>
        </div>
      ))}
      {team.pitching.length > 0 && (
        <table className="mscore-pitching">
          <thead>
            <tr>
              <th>Pitching</th>
              <th>IP</th>
              <th>H</th>
              <th>R</th>
              <th>ER</th>
              <th>BB</th>
              <th>K</th>
            </tr>
          </thead>
          <tbody>
            {team.pitching.map((p) => (
              <tr key={p.id}>
                <td className="mscore-pitching-name">
                  {p.name}
                  {p.decision && <span className="pitching-decision">{p.decision}</span>}
                </td>
                <td>{p.inningsPitched}</td>
                <td>{p.hits}</td>
                <td>{p.runs}</td>
                <td>{p.earnedRuns}</td>
                <td>{p.walks}</td>
                <td>{p.strikeouts}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function MiniLinescore({ sc }: { sc: Scorecard }) {
  const cols = sc.linescore;
  const row = (side: 'away' | 'home') => (
    <tr>
      <td className="mscore-ls-abbr">{sc.teams[side].team.abbreviation}</td>
      {cols.map((l) => (
        <td key={l.num}>{l[side].runs}</td>
      ))}
      <td className="mscore-ls-total">{sc.totals[side].r}</td>
      <td className="mscore-ls-total">{sc.totals[side].h}</td>
      <td className="mscore-ls-total">{sc.totals[side].e}</td>
    </tr>
  );
  return (
    <div className="mscore-ls-wrap">
      <table className="mscore-ls">
        <thead>
          <tr>
            <th />
            {cols.map((l) => (
              <th key={l.num}>{l.num}</th>
            ))}
            <th className="mscore-ls-total">R</th>
            <th className="mscore-ls-total">H</th>
            <th className="mscore-ls-total">E</th>
          </tr>
        </thead>
        <tbody>
          {row('away')}
          {row('home')}
        </tbody>
      </table>
    </div>
  );
}

export function MobileScorecard({
  scorecard,
  onOpenAtBat,
}: {
  scorecard: Scorecard;
  onOpenAtBat: (atBatIndex: number) => void;
}) {
  const [tab, setTab] = useState<'innings' | 'lineups'>('innings');

  return (
    <div className="mscore">
      <MiniLinescore sc={scorecard} />
      <div className="mscore-tabs" role="tablist">
        <button
          role="tab"
          aria-selected={tab === 'innings'}
          className={`mscore-tab${tab === 'innings' ? ' mscore-tab-on' : ''}`}
          onClick={() => setTab('innings')}
        >
          Play-by-play
        </button>
        <button
          role="tab"
          aria-selected={tab === 'lineups'}
          className={`mscore-tab${tab === 'lineups' ? ' mscore-tab-on' : ''}`}
          onClick={() => setTab('lineups')}
        >
          Lineups &amp; pitching
        </button>
      </div>

      {tab === 'innings' ? (
        <InningsFeed sc={scorecard} onOpen={onOpenAtBat} />
      ) : (
        <div className="mscore-lineups">
          <LineupBlock team={scorecard.teams.away} onOpen={onOpenAtBat} />
          <LineupBlock team={scorecard.teams.home} onOpen={onOpenAtBat} />
        </div>
      )}
      <p className="mscore-hint">Tap any play to see its pitch-by-pitch breakdown.</p>
    </div>
  );
}
