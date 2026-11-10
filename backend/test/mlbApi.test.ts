import { afterEach, describe, expect, it, vi } from 'vitest';
import { getLiveFeed, getPerson } from '../src/mlbApi.js';

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('MLB client request coalescing', () => {
  it('shares one upstream request between concurrent callers', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ gamePk: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    const [a, b] = await Promise.all([getLiveFeed(1), getLiveFeed(1)]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('still never caches the live feed between calls', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ gamePk: 2 }));
    vi.stubGlobal('fetch', fetchMock);

    await getLiveFeed(2);
    await getLiveFeed(2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps requests for different paths separate', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({}));
    vi.stubGlobal('fetch', fetchMock);

    await Promise.all([getLiveFeed(3), getLiveFeed(4)]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not pin a failure: the next caller retries', async () => {
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValueOnce(jsonResponse({ people: [{ id: 5, fullName: 'Back Again' }] }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(getPerson(5)).rejects.toThrow(/503/);
    const person = await getPerson(5);
    expect(person.people[0].fullName).toBe('Back Again');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('rejects every waiter when the shared request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));

    const results = await Promise.allSettled([getLiveFeed(6), getLiveFeed(6)]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
  });
});
