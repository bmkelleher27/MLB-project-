import { describe, expect, it } from 'vitest';
import {
  channelSearchUrl,
  classify,
  datesInTitle,
  matchVideo,
  pickVideos,
  type SearchItem,
  type VideoGame,
} from '../src/video/match.js';

const rangersMariners: VideoGame = {
  gameDate: '2026-09-10T23:05:00Z',
  officialDate: '2026-09-10',
  gameType: 'R',
  doubleHeader: 'N',
  gameNumber: 1,
  away: { name: 'Texas Rangers', teamName: 'Rangers' },
  home: { name: 'Seattle Mariners', teamName: 'Mariners' },
};

function item(over: Partial<SearchItem>): SearchItem {
  return {
    videoId: 'vid',
    title: '',
    description: '',
    channelId: 'UCoLrcjPV5PbUrUyXq5mjc_A',
    channelTitle: 'MLB',
    publishedAt: '2026-09-11T04:00:00Z',
    ...over,
  };
}

describe('classify', () => {
  it('reads MLB highlight titles as highlights, not full games', () => {
    expect(classify('RANGERS vs. MARINERS: Official Full Game Highlights (September 10)')).toBe('highlights');
  });
  it('reads full-game uploads as full', () => {
    expect(classify("Nolan Ryan's 6th No-Hitter (FULL GAME) | MLB Classic Games")).toBe('full');
  });
  it('ignores everything else', () => {
    expect(classify('Top 10 plays of the week')).toBeNull();
  });
});

describe('datesInTitle', () => {
  it('finds month-name and numeric dates', () => {
    expect(datesInTitle('Highlights (September 10)')).toEqual(['09-10']);
    expect(datesInTitle('Sept. 3, 2024 recap')).toEqual(['2024-09-03']);
    expect(datesInTitle('Game Highlights (3/15/25)')).toEqual(['2025-03-15']);
  });
  it('does not read a club name as a month', () => {
    expect(datesInTitle('Rangers 3, Mariners 5')).toEqual([]);
  });
});

describe('matchVideo', () => {
  it('accepts MLB highlights for this game', () => {
    const m = matchVideo(
      item({ title: 'RANGERS vs. MARINERS: Official Full Game Highlights (September 10) | 2026 MLB Season' }),
      rangersMariners
    );
    expect(m?.kind).toBe('highlights');
  });

  it('rejects highlights dated another day', () => {
    expect(
      matchVideo(item({ title: 'RANGERS vs. MARINERS: Official Full Game Highlights (September 9)' }), rangersMariners)
    ).toBeNull();
  });

  it('rejects highlights published outside the days after the game', () => {
    expect(
      matchVideo(
        item({ title: 'Rangers vs. Mariners Game Highlights', publishedAt: '2025-09-11T04:00:00Z' }),
        rangersMariners
      )
    ).toBeNull();
  });

  it('needs both clubs named', () => {
    expect(matchVideo(item({ title: 'RANGERS vs. ASTROS: Official Full Game Highlights' }), rangersMariners)).toBeNull();
  });

  it('does not let "Reds" match "Red Sox"', () => {
    const game: VideoGame = {
      ...rangersMariners,
      away: { name: 'Cincinnati Reds', teamName: 'Reds' },
      home: { name: 'Boston Red Sox', teamName: 'Red Sox' },
    };
    expect(matchVideo(item({ title: 'RED SOX vs. YANKEES Game Highlights' }), game)).toBeNull();
    expect(matchVideo(item({ title: 'REDS vs. RED SOX Game Highlights' }), game)?.kind).toBe('highlights');
  });

  it("knows MLB's short names for the D-backs and A's", () => {
    const game: VideoGame = {
      ...rangersMariners,
      away: { name: 'Arizona Diamondbacks', teamName: 'D-backs' },
      home: { name: 'Athletics', teamName: 'Athletics' },
    };
    expect(matchVideo(item({ title: "D-BACKS vs. A'S: Official Full Game Highlights" }), game)?.kind).toBe(
      'highlights'
    );
  });

  it('keeps doubleheader games apart', () => {
    const game2: VideoGame = { ...rangersMariners, doubleHeader: 'S', gameNumber: 2 };
    expect(matchVideo(item({ title: 'Rangers vs. Mariners Game 1 Highlights (9/10/26)' }), game2)).toBeNull();
    expect(matchVideo(item({ title: 'Rangers vs. Mariners Game 2 Highlights (9/10/26)' }), game2)?.kind).toBe(
      'highlights'
    );
  });

  it('accepts a full game uploaded years later when the year is written', () => {
    const old: VideoGame = {
      ...rangersMariners,
      gameDate: '2012-06-11T02:00:00Z',
      officialDate: '2012-06-10',
    };
    const m = matchVideo(
      item({
        title: 'Rangers vs. Mariners | June 10, 2012 (FULL GAME)',
        publishedAt: '2024-01-05T00:00:00Z',
      }),
      old
    );
    expect(m?.kind).toBe('full');
  });

  it('finds the matchup in a full game description', () => {
    const old: VideoGame = { ...rangersMariners, gameDate: '2012-06-11T02:00:00Z', officialDate: '2012-06-10' };
    const m = matchVideo(
      item({
        title: 'A perfect night in Seattle (FULL GAME)',
        description: 'Texas Rangers at Seattle Mariners, 2012.',
        publishedAt: '2024-01-05T00:00:00Z',
      }),
      old
    );
    expect(m?.kind).toBe('full');
  });
});

describe('pickVideos', () => {
  it('puts a full game ahead of highlights', () => {
    const picks = pickVideos(
      [
        item({ videoId: 'h', title: 'RANGERS vs. MARINERS: Official Full Game Highlights (September 10)' }),
        item({ videoId: 'f', title: 'Rangers vs. Mariners September 10, 2026 FULL GAME' }),
      ],
      rangersMariners
    );
    expect(picks.map((p) => [p.kind, p.videoId])).toEqual([
      ['full', 'f'],
      ['highlights', 'h'],
    ]);
  });

  it('returns nothing when nothing matches', () => {
    expect(pickVideos([item({ title: 'Best catches of 2026' })], rangersMariners)).toEqual([]);
  });
});

describe('channelSearchUrl', () => {
  it("searches MLB's channel for the matchup and date", () => {
    expect(channelSearchUrl(rangersMariners)).toBe(
      'https://www.youtube.com/@MLB/search?query=Rangers%20vs%20Mariners%20September%2010%202026'
    );
  });
});
