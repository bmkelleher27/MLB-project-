import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlayerSearchResult } from '@mlb-scorecards/shared';
import { searchPlayers } from '../api/client';

/**
 * Type-ahead player lookup. Debounced so a burst of keystrokes makes one
 * request, and every in-flight response is checked against the current query
 * so a slow earlier request can't overwrite newer results.
 */
export function PlayerSearch({ autoFocus = false }: { autoFocus?: boolean }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlayerSearchResult[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = window.setTimeout(() => {
      searchPlayers(q)
        .then((r) => {
          if (cancelled) return;
          setResults(r.players);
          setActive(0);
          setOpen(true);
          setError(null);
        })
        .catch((err) => {
          if (!cancelled) setError((err as Error).message);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  // A click anywhere else dismisses the result list.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const choose = (p: PlayerSearchResult) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(`/player/${p.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!results || results.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="player-search" ref={boxRef}>
      <input
        type="search"
        className="player-search-input"
        placeholder="Search a player…"
        aria-label="Search for a player"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => results && setOpen(true)}
        onKeyDown={onKeyDown}
      />
      {loading && <span className="player-search-spinner" aria-hidden="true" />}

      {open && (error || results) && (
        <ul className="player-search-results" role="listbox">
          {error && <li className="player-search-empty">{error}</li>}
          {!error && results?.length === 0 && (
            <li className="player-search-empty">No players matching “{query.trim()}”.</li>
          )}
          {!error &&
            results?.map((p, i) => (
              <li key={p.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  className={`player-search-item${i === active ? ' player-search-item-active' : ''}`}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(p)}
                >
                  <span className="player-search-name">{p.name}</span>
                  <span className="player-search-meta">
                    {p.position ?? '—'}
                    {p.team ? ` · ${p.team}` : ''}
                    {!p.active ? ' · retired' : ''}
                  </span>
                </button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
