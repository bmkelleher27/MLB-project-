import { describe, expect, it } from 'vitest';
import { watchInfo, type RawBroadcast } from '../src/broadcasts.js';

function tv(name: string, extra: Partial<RawBroadcast> = {}): RawBroadcast {
  return { name, type: 'TV', isNational: false, availableForStreaming: false, freeGame: false, ...extra };
}

describe('watchInfo', () => {
  it('is null when MLB lists no video feed', () => {
    expect(watchInfo(undefined, 17)).toBeNull();
    expect(watchInfo([], 1)).toBeNull();
    // Radio alone is not a way to watch.
    expect(watchInfo([{ name: 'WFAN 660', type: 'AM', availableForStreaming: true }], 1)).toBeNull();
  });

  it('treats streamable regional feeds in the majors as MLB.TV out of market', () => {
    const watch = watchInfo(
      [
        tv('SNY', { availableForStreaming: true }),
        tv('Nationals.TV', { availableForStreaming: true }),
        { name: 'WJFK 106.7 The Fan', type: 'FM', availableForStreaming: true },
      ],
      1
    );
    expect(watch).toEqual({ streams: ['MLB.TV (out of market)'], tv: [] });
  });

  it('flags the MLB.TV free game', () => {
    const watch = watchInfo([tv('YES', { availableForStreaming: true, freeGame: true })], 1);
    expect(watch?.streams).toEqual(['MLB.TV (free game)']);
  });

  it('names a national stream once, though it is listed for both clubs', () => {
    const watch = watchInfo(
      [
        tv('FOX / FOX ONE', { isNational: true }),
        tv('FOX / FOX ONE', { isNational: true, availableForStreaming: true }),
      ],
      1
    );
    expect(watch).toEqual({ streams: ['FOX / FOX ONE'], tv: [] });
  });

  it('lists a national channel with no stream as TV only', () => {
    expect(watchInfo([tv('ESPN', { isNational: true })], 1)).toEqual({ streams: [], tv: ['ESPN'] });
  });

  it('uses the feed name as the service outside the majors', () => {
    const milb = watchInfo(
      [tv('Bally Sports Live'), tv('MiLB.TV', { availableForStreaming: true }), tv('MiLB.TV')],
      11
    );
    expect(milb).toEqual({ streams: ['MiLB.TV'], tv: [] });

    const lidom = watchInfo(
      [tv('MLB.TV', { isNational: true }), tv('MLB.TV', { isNational: true, availableForStreaming: true })],
      17
    );
    expect(lidom).toEqual({ streams: ['MLB.TV'], tv: [] });
  });

  it('points Arizona Fall League feeds at the free MLB.com stream', () => {
    const afl = watchInfo([tv('MLB Video', { availableForStreaming: true }), tv('Pixellot')], 17);
    expect(afl).toEqual({ streams: ['MLB.com (free)'], tv: [] });
  });

  it('reports a listed game with nothing streamable as having no stream', () => {
    expect(watchInfo([tv('Pixellot')], 17)).toEqual({ streams: [], tv: [] });
  });
});
