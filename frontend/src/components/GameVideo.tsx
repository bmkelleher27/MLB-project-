import { useEffect, useState } from 'react';
import type { GameVideo as Video, GameVideoResponse } from '@mlb-scorecards/shared';
import { fetchGameVideo } from '../api/client';
import { Icon } from './Icon';

const KIND_LABEL: Record<Video['kind'], string> = {
  full: 'Full game',
  highlights: 'Full-game highlights',
};

/**
 * The finished game's official YouTube video, under the scorecard header.
 *
 * Shows a thumbnail first and loads YouTube's player only when it's clicked:
 * the embed pulls in about 1 MB of script, which most visits to a scorecard
 * never need. Uses the privacy-enhanced youtube-nocookie.com domain.
 *
 * Renders nothing while loading or if the lookup fails, so the scorecard never
 * waits on it.
 */
export function GameVideo({ gamePk }: { gamePk: number }) {
  const [data, setData] = useState<GameVideoResponse | null>(null);
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setSelected(0);
    setPlaying(false);
    fetchGameVideo(gamePk)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [gamePk]);

  if (!data) return null;

  if (data.videos.length === 0) {
    return (
      <p className="game-video-search">
        <a href={data.searchUrl} target="_blank" rel="noopener noreferrer">
          Find this game on MLB’s YouTube channel ›
        </a>
      </p>
    );
  }

  const video = data.videos[Math.min(selected, data.videos.length - 1)];
  const watchUrl = `https://www.youtube.com/watch?v=${video.videoId}`;

  return (
    <section className="game-video" aria-label="Game video">
      <div className="game-video-head">
        <h2 className="game-video-title">Watch</h2>
        {data.videos.length > 1 && (
          <div className="game-video-kinds" role="group" aria-label="Video">
            {data.videos.map((v, i) => (
              <button
                key={v.videoId}
                type="button"
                className={`level-chip${i === selected ? ' level-chip-on' : ''}`}
                aria-pressed={i === selected}
                onClick={() => {
                  setSelected(i);
                  setPlaying(false);
                }}
              >
                {KIND_LABEL[v.kind]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="game-video-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${video.videoId}?autoplay=1&rel=0`}
            title={video.title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button
            type="button"
            className="game-video-poster"
            onClick={() => setPlaying(true)}
            aria-label={`Play: ${video.title}`}
          >
            <img
              src={`https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`}
              alt=""
              loading="lazy"
            />
            <span className="game-video-play">
              <Icon name="play" size={28} />
            </span>
          </button>
        )}
      </div>

      <p className="game-video-caption">
        <span className="game-video-kind">{KIND_LABEL[video.kind]}</span>
        <span className="game-video-name">{video.title}</span>
        <a href={watchUrl} target="_blank" rel="noopener noreferrer" className="game-video-out">
          {video.channelTitle ? `${video.channelTitle} on YouTube` : 'Open on YouTube'} ›
        </a>
      </p>
    </section>
  );
}
