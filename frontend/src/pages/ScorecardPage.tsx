import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import type { Cell, GamePreviewResponse, Scorecard } from '@mlb-scorecards/shared';
import { fetchGamePreview, fetchScorecard } from '../api/client';
import { getSocket } from '../api/socket';
import { formatFullDate } from '../lib/date';
import { useIsMobile } from '../lib/useIsMobile';
import { GameStatusHeader } from '../components/GameStatusHeader';
import { MobileScorecard } from '../components/MobileScorecard';
import { NotationLegend } from '../components/NotationLegend';
import { PitchingTable } from '../components/PitchingTable';
import { PredictiveStats } from '../components/PredictiveStats';
import { PregameView } from '../components/PregameView';
import { ReplayControls } from '../components/ReplayControls';
import { ScorecardTable } from '../components/ScorecardTable';
import { ScoringSummary } from '../components/ScoringSummary';
import { ThemeToggle } from '../components/ThemeToggle';

function* allCells(scorecard: Scorecard): Generator<Cell> {
  for (const side of ['away', 'home'] as const) {
    for (const cells of Object.values(scorecard.teams[side].cellsBySlot)) {
      yield* cells;
    }
  }
}

function flashCell(atBatIndex: number, scroll: boolean) {
  const el = document.querySelector(`[data-at-bat-index="${atBatIndex}"]`);
  if (!(el instanceof HTMLElement)) return;
  if (scroll) el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  el.classList.remove('at-bat-cell-flash');
  // force a reflow so re-adding the class restarts the animation on repeat clicks
  void el.offsetWidth;
  el.classList.add('at-bat-cell-flash');
  window.setTimeout(() => el.classList.remove('at-bat-cell-flash'), 1800);
}

export function ScorecardPage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [preview, setPreview] = useState<GamePreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [replayStep, setReplayStep] = useState<number | null>(null);
  const prevMaxAbRef = useRef<number | null>(null);
  const deepLinkAppliedRef = useRef(false);

  useEffect(() => {
    if (!gamePk) return;
    const gamePkNum = Number(gamePk);
    let cancelled = false;
    setScorecard(null);
    setError(null);
    setReplayStep(null);
    prevMaxAbRef.current = null;
    deepLinkAppliedRef.current = false;

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

  const isLive = scorecard?.status.abstractGameState === 'Live';
  const isPreview = scorecard?.status.abstractGameState === 'Preview';
  const isMobile = useIsMobile();
  const useMobileLayout = isMobile && !isPreview;

  // Pre-game: pull the probable starters' recent-form panel. Purely an
  // enhancement, so a failure here never blocks the page.
  useEffect(() => {
    if (!isPreview || !gamePk) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    fetchGamePreview(Number(gamePk))
      .then((p) => {
        if (!cancelled) setPreview(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isPreview, gamePk]);

  const latestCell = useMemo(() => {
    if (!scorecard) return null;
    let latest: Cell | null = null;
    for (const cell of allCells(scorecard)) {
      if (!latest || cell.atBatIndex > latest.atBatIndex) latest = cell;
    }
    return latest;
  }, [scorecard]);

  // Live follow: when a new completed at-bat arrives over the socket, flash its
  // cell in place (no scroll - the ticker is the scroll affordance).
  useEffect(() => {
    if (!latestCell) return;
    const prev = prevMaxAbRef.current;
    prevMaxAbRef.current = latestCell.atBatIndex;
    if (isLive && prev !== null && latestCell.atBatIndex > prev) {
      flashCell(latestCell.atBatIndex, false);
    }
  }, [latestCell, isLive]);

  // ?ab= deep link: scroll to and flash the linked at-bat once, on first load
  // (used when returning to the scorecard from the pitch-by-pitch screen).
  useEffect(() => {
    if (!scorecard || deepLinkAppliedRef.current) return;
    deepLinkAppliedRef.current = true;
    const ab = params.get('ab');
    if (ab === null) return;
    const abNum = Number(ab);
    if (!atBatIndices.includes(abNum)) return;
    window.setTimeout(() => flashCell(abNum, true), 120);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scorecard, atBatIndices]);

  function openAtBat(atBatIndex: number) {
    navigate(`/game/${gamePk}/atbat/${atBatIndex}`);
  }

  const replayLimit =
    replayStep === null || atBatIndices.length === 0
      ? null
      : atBatIndices[Math.min(replayStep, atBatIndices.length - 1)];

  function jumpToCell(atBatIndex: number) {
    // If replay mode hasn't reached this play yet, advance the replay to it first.
    const pos = atBatIndices.indexOf(atBatIndex);
    if (replayStep !== null && pos > replayStep) setReplayStep(pos);
    // Defer so a replay-step re-render can unhide the cell before we scroll to it.
    window.setTimeout(() => flashCell(atBatIndex, true), 60);
  }

  return (
    <>
      <div className="scorecard-nav-bar">
        <Link to="/" className="scorecard-nav-back">‹ Schedule</Link>
        {scorecard?.date && (
          <span className="scorecard-nav-date">{formatFullDate(scorecard.date)}</span>
        )}
        <div className="scorecard-nav-actions">
          {scorecard && (
            <button className="nav-legend-btn" onClick={() => window.print()} title="Print or save this scorecard as a PDF">
              ⤓ Export PDF
            </button>
          )}
          <button
            className={`nav-legend-btn${legendOpen ? ' nav-legend-btn-active' : ''}`}
            onClick={() => setLegendOpen((o) => !o)}
          >
            ? How to read
          </button>
          <ThemeToggle />
        </div>
      </div>
      <div className={`scorecard-page${useMobileLayout ? ' scorecard-page-mobile' : ''}`}>
        {legendOpen && <NotationLegend />}
        {error && <p className="status-message status-error">{error}</p>}
        {!error && !scorecard && (
          <div className="scorecard-skeleton" aria-hidden="true">
            <div className="skeleton skeleton-header" />
            <div className="skeleton skeleton-table" />
            <div className="skeleton skeleton-table" />
          </div>
        )}
        {scorecard && (
          <>
            <GameStatusHeader scorecard={scorecard} />
            {isLive && latestCell && (
              <button
                className="live-ticker"
                onClick={() => jumpToCell(latestCell.atBatIndex)}
                title="Show this play on the scorecard"
              >
                <span className="live-dot" />
                <span className="live-ticker-label">
                  Latest · {latestCell.halfInning === 'top' ? 'T' : 'B'}{latestCell.inning}
                </span>
                <span className="live-ticker-desc">{latestCell.description}</span>
              </button>
            )}
            {isPreview && preview && <PregameView preview={preview} />}
            {useMobileLayout && (
              <MobileScorecard scorecard={scorecard} onOpenAtBat={openAtBat} />
            )}
            {!isPreview && !useMobileLayout && <ScoringSummary scorecard={scorecard} onJump={jumpToCell} />}
            {!isPreview && !useMobileLayout && (
              <ReplayControls totalPlays={atBatIndices.length} step={replayStep} onChange={setReplayStep} />
            )}
            {!isPreview && !useMobileLayout && (
            <div className="scorecard-tables">
              <ScorecardTable
                team={scorecard.teams.away}
                linescore={scorecard.linescore}
                totals={scorecard.totals.away}
                side="away"
                currentInning={isLive && scorecard.halfInning === 'top' ? scorecard.inning : null}
                replayLimit={replayLimit}
                onSelectCell={(cell) => openAtBat(cell.atBatIndex)}
                onAdvancementClick={jumpToCell}
                seasonYear={scorecard.date ? Number(scorecard.date.slice(0, 4)) : null}
              />
              <PitchingTable
                teamName={scorecard.teams.away.team.name}
                pitching={scorecard.teams.away.pitching}
                seasonYear={scorecard.date ? Number(scorecard.date.slice(0, 4)) : null}
              />
              <PredictiveStats teamName={scorecard.teams.away.team.name} predictive={scorecard.predictive.away} />
              <ScorecardTable
                team={scorecard.teams.home}
                linescore={scorecard.linescore}
                totals={scorecard.totals.home}
                side="home"
                currentInning={isLive && scorecard.halfInning === 'bottom' ? scorecard.inning : null}
                replayLimit={replayLimit}
                onSelectCell={(cell) => openAtBat(cell.atBatIndex)}
                onAdvancementClick={jumpToCell}
                seasonYear={scorecard.date ? Number(scorecard.date.slice(0, 4)) : null}
              />
              <PitchingTable
                teamName={scorecard.teams.home.team.name}
                pitching={scorecard.teams.home.pitching}
                seasonYear={scorecard.date ? Number(scorecard.date.slice(0, 4)) : null}
              />
              <PredictiveStats teamName={scorecard.teams.home.team.name} predictive={scorecard.predictive.home} />
            </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
