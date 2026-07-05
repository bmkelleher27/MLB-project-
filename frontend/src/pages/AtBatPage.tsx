import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { AtBatDetailResponse } from '@mlb-scorecards/shared';
import { fetchGameAtBats } from '../api/client';
import { AtBatCard } from '../components/AtBatCard';

interface InningGroup {
  key: string;
  label: string;
  atBats: AtBatDetailResponse[];
}

export function AtBatPage() {
  const { gamePk, atBatIndex } = useParams<{ gamePk: string; atBatIndex: string }>();
  const focus = atBatIndex != null ? Number(atBatIndex) : null;
  const [atBats, setAtBats] = useState<AtBatDetailResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!gamePk) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchGameAtBats(Number(gamePk))
      .then((d) => {
        if (!cancelled) setAtBats(d.atBats);
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
  }, [gamePk]);

  // Scroll to the clicked at-bat once the cards have rendered.
  useEffect(() => {
    if (!atBats || focus == null) return;
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
      </div>
      <div className="atbat-page">
        {error && <p className="status-message status-error">{error}</p>}
        {loading && <p className="status-message">Loading pitches…</p>}
        {!loading && atBats && atBats.length === 0 && (
          <p className="status-message">No pitch data for this game.</p>
        )}

        {!loading && atBats && atBats.length > 0 && (
          <p className="atbat-note atbat-page-note">
            One strike zone per plate appearance (catcher's view); dots are colored{' '}
            <span className="atbat-legend-strike">strike</span>,{' '}
            <span className="atbat-legend-ball">ball</span>,{' '}
            <span className="atbat-legend-inplay">in play</span>. IVB = induced vertical break, IHB = horizontal
            break (inches). <strong>Stuff</strong> is an estimated pitch-quality index (100 = league average,
            higher = nastier) computed here from velocity, movement, and extension — an approximation of Stuff+,
            not the trademarked model.
            {!hasMovement && ' Break and Stuff are only available for games from 2015 onward.'}
          </p>
        )}

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
