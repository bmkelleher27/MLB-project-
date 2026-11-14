import { describe, expect, it } from 'vitest';
import { pickGameVideos, type RawContentVideo, type RawGameContent } from '../src/video/mlbContent.js';

const MP4 = 'https://mlb-cuts-diamond.mlb.com/FORGE/2026/2026-09/26/abc_1280x720_59_4000K.mp4';

function video(extra: Partial<RawContentVideo> = {}): RawContentVideo {
  return {
    type: 'video',
    date: '2026-09-26T20:33:14.286Z',
    slug: 'condensed-game-nym-wsh-9-26-26',
    headline: 'Condensed Game: NYM@WSH - 9/26/26',
    duration: '00:11:15',
    image: {
      cuts: [
        { aspectRatio: '16:9', width: 1920, src: 'https://img.mlbstatic.com/a/w_1920.jpg' },
        { aspectRatio: '16:9', width: 960, src: 'https://img.mlbstatic.com/a/w_960.jpg' },
        { aspectRatio: '16:9', width: 320, src: 'https://img.mlbstatic.com/a/w_320.jpg' },
        { aspectRatio: '4:3', width: 960, src: 'https://img.mlbstatic.com/a/4x3.jpg' },
      ],
    },
    playbacks: [
      { name: 'hlsCloud', url: 'https://mlb-cuts-diamond.mlb.com/FORGE/abc.m3u8' },
      { name: 'mp4Avc', url: MP4 },
    ],
    ...extra,
  };
}

function content(...groups: Array<{ title?: string; items: RawContentVideo[] }>): RawGameContent {
  return { media: { epgAlternate: groups } };
}

describe('pickGameVideos', () => {
  it('returns nothing when MLB produced no post-game video', () => {
    expect(pickGameVideos(undefined)).toEqual([]);
    expect(pickGameVideos({})).toEqual([]);
    expect(pickGameVideos(content({ title: 'Extended Highlights', items: [] }))).toEqual([]);
  });

  it('reads the condensed game as a playable MP4 with poster and link', () => {
    const [v] = pickGameVideos(content({ title: 'Extended Highlights', items: [video()] }));
    expect(v).toEqual({
      kind: 'condensed',
      title: 'Condensed Game: NYM@WSH - 9/26/26',
      durationSeconds: 675,
      url: MP4,
      poster: 'https://img.mlbstatic.com/a/w_960.jpg',
      pageUrl: 'https://www.mlb.com/video/condensed-game-nym-wsh-9-26-26',
      publishedAt: '2026-09-26T20:33:14.286Z',
    });
  });

  it('puts the condensed game before the recap whatever order MLB lists them in', () => {
    const videos = pickGameVideos(
      content(
        { title: 'Daily Recap', items: [video({ slug: 'recap', headline: 'Mets win 7-1', duration: '00:03:42' })] },
        { title: 'Extended Highlights', items: [video()] }
      )
    );
    expect(videos.map((v) => v.kind)).toEqual(['condensed', 'recap']);
    expect(videos[1].durationSeconds).toBe(222);
  });

  it('falls back to MLB\'s own tags when a group is titled differently', () => {
    const tagged = video({ keywordsAll: [{ type: 'mlbtax', value: 'mlb_recap' }] });
    expect(pickGameVideos(content({ title: 'Something New', items: [tagged] }))[0].kind).toBe('recap');
    expect(pickGameVideos(content({ title: 'Something New', items: [video()] }))).toEqual([]);
  });

  it('skips a video with no MP4 or one hosted off MLB', () => {
    const hlsOnly = video({ playbacks: [{ name: 'hlsCloud', url: 'https://mlb-cuts-diamond.mlb.com/x.m3u8' }] });
    const elsewhere = video({ playbacks: [{ name: 'mp4Avc', url: 'https://evil.example/mlb.com/x.mp4' }] });
    const insecure = video({ playbacks: [{ name: 'mp4Avc', url: MP4.replace('https:', 'http:') }] });
    for (const item of [hlsOnly, elsewhere, insecure]) {
      expect(pickGameVideos(content({ title: 'Daily Recap', items: [item] }))).toEqual([]);
    }
  });

  it('tolerates a missing poster, slug or duration', () => {
    const [v] = pickGameVideos(
      content({ title: 'Daily Recap', items: [video({ image: undefined, slug: undefined, duration: undefined })] })
    );
    expect(v.poster).toBeNull();
    expect(v.pageUrl).toBeNull();
    expect(v.durationSeconds).toBeNull();
  });
});
