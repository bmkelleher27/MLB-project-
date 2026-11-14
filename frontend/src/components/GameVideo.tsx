import { useEffect, useState } from 'react';
import type { GameVideo as Video, GameVideoResponse } from '@mlb-scorecards/shared';
import { fetchGameVideo } from '../api/client';

const KIND_LABEL: Record<Video['kind'], string> = {
  condensed: 'Condensed game',
  recap: 'Recap',
};

/** 675 → "11:15". */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

/**
 * MLB's own video for a finished game, under the scorecard header: the
 * condensed game and the short recap, played in the browser's native player
 * straight from MLB's servers.
 *
 * Nothing is downloaded until play is pressed (`preload="none"`), so the
 * scorecard never pays for video it isn't asked to show. Renders nothing while
 * loading, if the lookup fails, or when MLB has no video for the game.
 */
export function GameVideo({ gamePk }: { gamePk: number }) {
  const [data, setData] = useState<GameVideoResponse | null>(null);
  const [selected, setSelected] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setSelected(0);
    fetchGameVideo(gamePk)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gamePk]);

  if (!data || data.videos.length === 0) return null;

  const video = data.videos[Math.min(selected, data.videos.length - 1)];

  return (
    <section className="game-video" aria-label="Game video">
      <div className="game-video-head">
        <h2 className="game-video-title">Watch</h2>
        {data.videos.length > 1 && (
          <div className="game-video-kinds" role="group" aria-label="Video">
            {data.videos.map((v, i) => (
              <button
                key={v.kind}
                type="button"
                className={`level-chip${i === selected ? ' level-chip-on' : ''}`}
                aria-pressed={i === selected}
                onClick={() => setSelected(i)}
              >
                {KIND_LABEL[v.kind]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="game-video-frame">
        {/* Keyed by URL so switching videos resets the player. */}
        <video
          key={video.url}
          src={video.url}
          poster={video.poster ?? undefined}
          controls
          playsInline
          preload="none"
          aria-label={video.title || KIND_LABEL[video.kind]}
        />
      </div>

      <p className="game-video-caption">
        <span className="game-video-kind">
          {KIND_LABEL[video.kind]}
          {video.durationSeconds != null && ` · ${formatDuration(video.durationSeconds)}`}
        </span>
        <span className="game-video-name">{video.title}</span>
        {video.pageUrl && (
          <a href={video.pageUrl} target="_blank" rel="noopener noreferrer" className="game-video-out">
            Watch on MLB.com ›
          </a>
        )}
      </p>
    </section>
  );
}
