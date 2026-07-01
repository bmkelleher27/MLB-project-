import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Cell, Scorecard } from '@mlb-scorecards/shared';
import { fetchScorecard } from '../api/client';
import { getSocket } from '../api/socket';
import { AtBatDetail } from '../components/AtBatDetail';
import { GameStatusHeader } from '../components/GameStatusHeader';
import { NotationLegend } from '../components/NotationLegend';
import { PitchingTable } from '../components/PitchingTable';
import { PredictiveStats } from '../components/PredictiveStats';
import { ReplayControls } from '../components/ReplayControls';
import { ScorecardTable } from '../components/ScorecardTable';
import { ScoringSummary } from '../components/ScoringSummary';

function formatGameDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'short', month: 'long', day: 'numeric', year: 'numeric',
  });
}

function* allCells(scorecard: Scorecard): Generator<Cell> {
  for (const side of ['away', 'home'] as const) {
    for (const cells of Object.values(scorecard.teams[side].cellsBySlot)) {
      yield* cells;
    }
  }
}

function flashCell(atBatIndex: number) {
  const el = document.querySelector(`[data-at-bat-index="${atBatIndex}"]`);
  if (!(el instanceof HTMLElement)) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  el.classList.remove('at-bat-cell-flash');
  // force a reflow so re-adding the class restarts the animation on repeat clicks
  void el.offsetWidth;
  el.classList.add('at-bat-cell-flash');
  window.setTimeout(() => el.classList.remove('at-bat-cell-flash'), 1800);
}

export function ScorecardPage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [selectedAtBatIndex, setSelectedAtBatIndex] = useState<number | null>(null);
  const [replayStep, setReplayStep] = useState<number | null>(null);

  useEffect(() => {
    if (!gamePk) return;
    const gamePkNum = Number(gamePk);
    let cancelled = false;
    setScorecard(null);
    setError(null);
    setSelectedAtBatIndex(null);
    setReplayStep(null);

    fetchScorecard(gamePkNum)
      .then((sc) => {
        if (!cancelled) setScorecard(sc);
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });

    const socket = getSocket();
    const handleScorecard = (sc: Scorecard) => {
      if (sc.gamePk === gamePkNum) setScorecard(sc);
    };
    const handleScorecardError = (e: { message: string }) => setError(e.message);

    socket.on('scorecard', handleScorecard);
    socket.on('scorecard:error', handleScorecardError);
    socket.emit('subscribe', gamePkNum);

    return () => {
      cancelled = true;
      socket.emit('unsubscribe');
      socket.off('scorecard', handleScorecard);
      socket.off('scorecard:error', handleScorecardError);
    };
  }, [gamePk]);

  const atBatIndices = useMemo(() => {
    if (!scorecard) return [];
    const set = new Set<number>();
    for (const cell of allCells(scorecard)) set.add(cell.atBatIndex);
    return [...set].sort((a, b) => a - b);
  }, [scorecard]);

  const replayLimit =
    replayStep === null || atBatIndices.length === 0
      ? null
      : atBatIndices[Math.min(replayStep, atBatIndices.length - 1)];

  const selectedCell = useMemo(() => {
    if (!scorecard || selectedAtBatIndex === null) return null;
    for (const cell of allCells(scorecard)) {
      if (cell.atBatIndex === selectedAtBatIndex) return cell;
    }
    return null;
  }, [scorecard, selectedAtBatIndex]);

  function jumpToCell(atBatIndex: number) {
    // If replay mode hasn't reached this play yet, advance the replay to it first.
    const pos = atBatIndices.indexOf(atBatIndex);
    if (replayStep !== null && pos > replayStep) setReplayStep(pos);
    // Defer so a replay-step re-render can unhide the cell before we scroll to it.
    window.setTimeout(() => flashCell(atBatIndex), 60);
  }

  const isLive = scorecard?.status.abstractGameState === 'Live';

  return (
    <>
      <div className="scorecard-nav-bar">
        <Link to="/" className="scorecard-nav-back">‹ Schedule</Link>
        {scorecard?.date && (
          <span className="scorecard-nav-date">{formatGameDate(scorecard.date)}</span>
        )}
        <button
          className={`nav-legend-btn${legendOpen ? ' nav-legend-btn-active' : ''}`}
          onClick={() => setLegendOpen((o) => !o)}
        >
          ? How to read
        </button>
      </div>
      <div className={`scorecard-page${selectedCell ? ' scorecard-page-detail-open' : ''}`}>
        {legendOpen && <NotationLegend />}
        {error && <p className="status-message status-error">{error}</p>}
        {!error && !scorecard && <p className="status-message">Loading scorecard...</p>}
        {scorecard && (
          <>
            <GameStatusHeader scorecard={scorecard} />
            <ScoringSummary scorecard={scorecard} onJump={jumpToCell} />
            <ReplayControls totalPlays={atBatIndices.length} step={replayStep} onChange={setReplayStep} />
            <div className="scorecard-tables">
              <ScorecardTable
                team={scorecard.teams.away}
                linescore={scorecard.linescore}
                totals={scorecard.totals.away}
                side="away"
                currentInning={isLive && scorecard.halfInning === 'top' ? scorecard.inning : null}
                selectedAtBatIndex={selectedAtBatIndex}
                replayLimit={replayLimit}
                onSelectCell={(cell) =>
                  setSelectedAtBatIndex((cur) => (cur === cell.atBatIndex ? null : cell.atBatIndex))
                }
                onAdvancementClick={jumpToCell}
              />
              <PitchingTable teamName={scorecard.teams.away.team.name} pitching={scorecard.teams.away.pitching} />
              <PredictiveStats teamName={scorecard.teams.away.team.name} predictive={scorecard.predictive.away} />
              <ScorecardTable
                team={scorecard.teams.home}
                linescore={scorecard.linescore}
                totals={scorecard.totals.home}
                side="home"
                currentInning={isLive && scorecard.halfInning === 'bottom' ? scorecard.inning : null}
                selectedAtBatIndex={selectedAtBatIndex}
                replayLimit={replayLimit}
                onSelectCell={(cell) =>
                  setSelectedAtBatIndex((cur) => (cur === cell.atBatIndex ? null : cell.atBatIndex))
                }
                onAdvancementClick={jumpToCell}
              />
              <PitchingTable teamName={scorecard.teams.home.team.name} pitching={scorecard.teams.home.pitching} />
              <PredictiveStats teamName={scorecard.teams.home.team.name} predictive={scorecard.predictive.home} />
            </div>
          </>
        )}
        {selectedCell && (
          <AtBatDetail
            cell={selectedCell}
            onClose={() => setSelectedAtBatIndex(null)}
            onAdvancementClick={jumpToCell}
          />
        )}
      </div>
    </>
  );
}
