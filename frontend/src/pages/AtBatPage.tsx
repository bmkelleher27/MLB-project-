import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AtBatDetailResponse, GameAtBatsResponse } from '@mlb-scorecards/shared';
import { fetchGameAtBats } from '../api/client';
import { getSocket } from '../api/socket';
import { AtBatCard } from '../components/AtBatCard';
import { FatigueCharts } from '../components/FatigueChart';
import { PitchMovementPlots } from '../components/PitchMovementPlots';
import { PitchUsage } from '../components/PitchUsage';
import { SprayCharts } from '../components/SprayChart';

interface InningGroup {
  key: string;
  label: string;
  atBats: AtBatDetailResponse[];
}

export function AtBatPage() {
  const { gamePk, atBatIndex } = useParams<{ gamePk: string; atBatIndex: string }>();
  const focus = atBatIndex != null ? Number(atBatIndex) : null;
  const [data, setData] = useState<GameAtBatsResponse | null>(null);
  const atBats = data?.atBats ?? null;
  const status = data?.status ?? null;
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const scrolledToFocusRef = useRef(false);

  useEffect(() => {
    if (!gamePk) return;
    const gamePkNum = Number(gamePk);
    let cancelled = false;
    let subscribed = false;
    const socket = getSocket();

    const handleAtBats = (payload: GameAtBatsResponse) => {
      if (payload.gamePk === gamePkNum) setData(payload);
    };

    setLoading(true);
    setError(null);
    fetchGameAtBats(gamePkNum)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        // Anything not yet Final can still change (Preview games go Live);
        // follow the game over the socket so new pitches appear as they happen.
        if (d.status.abstractGameState !== 'Final') {
          subscribed = true;
          socket.on('atbats', handleAtBats);
          socket.emit('subscribe:atbats', gamePkNum);
        }
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      if (subscribed) {
        socket.emit('unsubscribe');
        socket.off('atbats', handleAtBats);
      }
    };
  }, [gamePk]);

  // Scroll to the clicked at-bat once the cards have rendered — only on the
  // first load, so live refreshes don't yank the reader back up the page.
  useEffect(() => {
    if (!atBats || focus == null || scrolledToFocusRef.current) return;
    scrolledToFocusRef.current = true;
    const t = window.setTimeout(() => {
      document.getElementById(`ab-${focus}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [atBats, focus]);

  const groups = useMemo<InningGroup[]>(() => {
    if (!atBats) return [];
    const out: InningGroup[] = [];
    for (const ab of atBats) {
      const key = `${ab.inning}-${ab.halfInning}`;
      const last = out[out.length - 1];
      if (!last || last.key !== key) {
        out.push({
          key,
          label: `${ab.halfInning === 'top' ? '▲ Top' : '▼ Bottom'} ${ab.inning}`,
          atBats: [ab],
        });
      } else {
        last.atBats.push(ab);
      }
    }
    return out;
  }, [atBats]);

  const hasMovement = atBats?.some((ab) => ab.pitches.some((p) => p.ivb != null)) ?? false;
  const isLive = status?.abstractGameState === 'Live';

  return (
    <>
      <div className="scorecard-nav-bar">
        <Link
          to={`/game/${gamePk}${focus != null ? `?ab=${focus}` : ''}`}
          className="scorecard-nav-back"
        >
          ‹ Back to scorecard
        </Link>
        <span className="scorecard-nav-date">Pitch-by-pitch · full game</span>
        {isLive && (
          <span className="atbat-live-badge">
            <span className="live-dot" aria-hidden="true" />
            Live — updates automatically
          </span>
        )}
      </div>
      <div className="atbat-page">
        {error && <p className="status-message status-error">{error}</p>}
        {loading && (
          <div className="atbat-skeleton" aria-hidden="true">
            <span className="visually-hidden">Loading pitches…</span>
            <div className="skeleton skeleton-atbat-note" />
            <div className="atbat-skeleton-plots">
              <div className="skeleton skeleton-atbat-plot" />
              <div className="skeleton skeleton-atbat-plot" />
            </div>
            <div className="skeleton skeleton-atbat-chart" />
            <div className="skeleton skeleton-atbat-card" />
            <div className="skeleton skeleton-atbat-card" />
          </div>
        )}
        {!loading && atBats && atBats.length === 0 && (
          <p className="status-message">
            {status && status.abstractGameState !== 'Final'
              ? 'No pitches yet — this page will fill in as the game starts.'
              : 'No pitch data for this game.'}
          </p>
        )}

        {!loading && atBats && atBats.length > 0 && (
          <p className="atbat-note atbat-page-note">
            One strike zone per plate appearance (catcher's view); dots are colored{' '}
            <span className="atbat-legend-strike">strike</span>,{' '}
            <span className="atbat-legend-ball">ball</span>,{' '}
            <span className="atbat-legend-inplay">in play</span>. IVB = induced vertical break, IHB = horizontal
            break (inches). <strong>Stuff</strong> is an estimated pitch-quality index computed here from velocity,
            movement, and extension — an approximation of Stuff+, not the trademarked model. 100 = league average:{' '}
            <strong>130+</strong> is plus-plus (<strong>++</strong>), <strong>115–129</strong> plus (<strong>+</strong>),{' '}
            <strong>85–114</strong> average, and <strong>below 85</strong> below average (<strong>−</strong>).
            {!hasMovement && ' Break and Stuff are only available for games from 2015 onward.'}
          </p>
        )}

        {!loading && atBats && hasMovement && <PitchMovementPlots atBats={atBats} />}
        {!loading && atBats && <FatigueCharts atBats={atBats} />}
        {!loading && atBats && <PitchUsage atBats={atBats} />}
        {!loading && data && <SprayCharts data={data} />}

        {groups.map((g) => (
          <section key={g.key} className="atbat-inning-group">
            <h2 className="atbat-inning-title">{g.label}</h2>
            {g.atBats.map((ab) => (
              <AtBatCard key={ab.atBatIndex} ab={ab} focused={ab.atBatIndex === focus} />
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
