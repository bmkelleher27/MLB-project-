import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { Scorecard } from '@mlb-scorecards/shared';
import { fetchScorecard } from '../api/client';
import { getSocket } from '../api/socket';
import { GameStatusHeader } from '../components/GameStatusHeader';
import { PitchingTable } from '../components/PitchingTable';
import { ScorecardTable } from '../components/ScorecardTable';

export function ScorecardPage() {
  const { gamePk } = useParams<{ gamePk: string }>();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!gamePk) return;
    const gamePkNum = Number(gamePk);
    let cancelled = false;
    setScorecard(null);
    setError(null);

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

  return (
    <div className="scorecard-page">
      <Link to="/" className="back-link">
        ‹ Back to schedule
      </Link>
      {error && <p className="status-message status-error">{error}</p>}
      {!error && !scorecard && <p className="status-message">Loading scorecard...</p>}
      {scorecard && (
        <>
          <GameStatusHeader scorecard={scorecard} />
          <div className="scorecard-tables">
            <ScorecardTable
              team={scorecard.teams.away}
              linescore={scorecard.linescore}
              totals={scorecard.totals.away}
              side="away"
            />
            <PitchingTable teamName={scorecard.teams.away.team.name} pitching={scorecard.teams.away.pitching} />
            <ScorecardTable
              team={scorecard.teams.home}
              linescore={scorecard.linescore}
              totals={scorecard.totals.home}
              side="home"
            />
            <PitchingTable teamName={scorecard.teams.home.team.name} pitching={scorecard.teams.home.pitching} />
          </div>
        </>
      )}
    </div>
  );
}
